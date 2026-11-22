// @vitest-environment jsdom
import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {AuthContext} from '../auth/auth-context'
import {requestJson,downloadReport} from '../auth/api'
import ReportPanel from './ReportPanel'
import Dashboard from '../pages/Dashboard'
import {php,manilaDates} from './format'
vi.mock('../auth/api',()=>({requestJson:vi.fn(),downloadReport:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
const summary={data:[],sales_amount:'9007199254740993.01',transactions:2,reviewed:1,unreviewed:1,excluded_records:0}
test('Admin exports use applied server filters and exclude pagination; failures remain visible',async()=>{
  requestJson.mockResolvedValue(summary);downloadReport.mockResolvedValue(undefined)
  mount(<ReportPanel/>,'admin');await screen.findByText('PHP 9,007,199,254,740,993.01')
  await userEvent.click(screen.getByRole('button',{name:'Export Excel (.xlsx)'}))
  expect(downloadReport.mock.calls[0][0]).toContain('/reports/sales/export?from=')
  expect(downloadReport.mock.calls[0][0]).toContain('format=xlsx')
  expect(downloadReport.mock.calls[0][0]).not.toContain('page=')
  downloadReport.mockRejectedValueOnce(new Error('Export unavailable'))
  await userEvent.click(screen.getByRole('button',{name:'Export PDF'}));await screen.findByText('Export unavailable')
})
test('Manager export actions are absent and Admin slow-moving filter is explicit',async()=>{
  requestJson.mockResolvedValue(summary);mount(<ReportPanel/>,'manager');await screen.findByText('PHP 9,007,199,254,740,993.01')
  expect(screen.queryByRole('button',{name:'Export PDF'})).toBeNull();cleanup()
  mount(<ReportPanel/>,'admin');await userEvent.selectOptions(screen.getByLabelText('Report'),'slow-moving')
  await screen.findByLabelText('Maximum units sold in range')
  await userEvent.clear(screen.getByLabelText('Maximum units sold in range'));await userEvent.type(screen.getByLabelText('Maximum units sold in range'),'3')
  await userEvent.click(screen.getByRole('button',{name:'Apply / refresh'}))
  await waitFor(()=>expect(requestJson.mock.calls.at(-1)[0]).toContain('max_units=3'))
})
function mount(node,role='manager'){render(<MemoryRouter><AuthContext.Provider value={{user:{role,full_name:'Staff'},logout:vi.fn()}}>{node}</AuthContext.Provider></MemoryRouter>)}
test('Admin category rankings display server ranks and export applied category without client recalculation',async()=>{
  requestJson.mockImplementation(async path=>path.startsWith('/reports/best-selling')?{data:[{current_category:'Recorded category',category_rank:2,name:'Recorded medicine',units:'3',sales_amount:'12.34'}],excluded_records:0}:summary)
  downloadReport.mockResolvedValue(undefined);mount(<ReportPanel/>,'admin');await userEvent.selectOptions(screen.getByLabelText('Report'),'best-selling')
  await screen.findByText('Recorded medicine');expect(screen.getByRole('columnheader',{name:'Rank in category'})).toBeTruthy()
  await userEvent.type(screen.getByLabelText('Category (exact current label)'),'Recorded category');await userEvent.click(screen.getByRole('button',{name:'Apply / refresh'}))
  await waitFor(()=>expect(requestJson.mock.calls.at(-1)[0]).toContain('category=Recorded+category'))
  await userEvent.click(screen.getByRole('button',{name:'Export Excel (.xlsx)'}));expect(downloadReport.mock.calls.at(-1)[0]).toContain('category=Recorded+category')
})
test('money formatting preserves precision and Manila date crosses UTC boundary',()=>{
  expect(php('9007199254740993.01')).toBe('PHP 9,007,199,254,740,993.01')
  expect(php(null)).toBe('Unavailable')
  expect(manilaDates(new Date('2026-01-04T16:00:00Z'))).toEqual({today:'2026-01-05',monday:'2026-01-05'})
})
test('employee dashboard does not fetch financial reports',()=>{
  mount(<Dashboard/>,'employee');expect(requestJson).not.toHaveBeenCalled()
  expect(screen.getByRole('link',{name:/Cashier workspace/})).toBeTruthy()
  expect(screen.queryByRole('region',{name:'Management summary'})).toBeNull()
})
test.each(['manager','admin'])('%s dashboard chart and product-performance visibility respect current report permissions',async role=>{
  requestJson.mockImplementation(async path=>path.startsWith('/reports/products')?{data:[{product_id:1,name:'Recorded product',units:'2',sales_amount:'12.34'}]}:{...summary,data:[]})
  mount(<Dashboard/>,role)
  await screen.findByText('No sales trend data for this range.')
  expect(requestJson.mock.calls.some(([path])=>path.startsWith('/reports/products'))).toBe(role==='admin')
  expect(requestJson.mock.calls.some(([path])=>path.startsWith('/audit-logs'))).toBe(role==='admin')
  if(role==='admin')await screen.findByText('Recorded product')
  else expect(screen.queryByRole('region',{name:'Product performance'})).toBeNull()
})

test('dashboard alert records and Admin activity use actual read APIs without invented samples',async()=>{
  requestJson.mockImplementation(async path=>path.startsWith('/audit-logs')?{data:[{log_id:7,action:'sale.paid:4',username:'Recorded cashier',logged_at:'2026-11-20 09:00:00'}]}:path.startsWith('/reports/low-stock')?{total:1,data:[{product_id:2,name:'Recorded low medicine',qty_on_hand:'2',reorder_level:5}]}:path.startsWith('/reports/near-expiry')?{total:1,data:[{batch_id:8,product_name:'Recorded expiry medicine',batch_no:'REC-8',expiry_date:'2026-12-01',qty_on_hand:'3'}]}:{...summary,data:[]})
  mount(<Dashboard/>,'admin')
  await screen.findByText('Recorded low medicine is running low')
  expect(screen.getByText('Recorded expiry medicine · Batch REC-8')).toBeTruthy()
  expect(await screen.findByText('sale.paid:4')).toBeTruthy()
  expect(screen.getByText(/Recorded cashier · 2026-11-20 09:00:00/)).toBeTruthy()
  expect(requestJson.mock.calls.some(([path])=>path==='/reports/near-expiry?limit=2')).toBe(true)
})
test('dashboard Daily/Weekly controls use existing report grouping with unchanged date bounds',async()=>{
  requestJson.mockResolvedValue({...summary,data:[]})
  mount(<Dashboard/>,'manager')
  await screen.findByText('No sales trend data for this range.')
  const {today,monday}=manilaDates()
  const daily=screen.getByRole('button',{name:'Daily'}), weekly=screen.getByRole('button',{name:'Weekly'})
  expect(daily.getAttribute('aria-pressed')).toBe('true')
  await userEvent.click(weekly)
  await waitFor(()=>expect(weekly.getAttribute('aria-pressed')).toBe('true'))
  expect(requestJson.mock.calls.filter(([path])=>path.startsWith('/reports/sales')).at(-1)[0]).toBe(`/reports/sales?from=${monday}&to=${today}&period=week`)
  await userEvent.click(daily)
  await waitFor(()=>expect(requestJson.mock.calls.filter(([path])=>path.startsWith('/reports/sales')).at(-1)[0]).toBe(`/reports/sales?from=${monday}&to=${today}&period=day`))
})
test('manager sees historical-review metadata but no monthly or admin options',async()=>{
  requestJson.mockResolvedValue(summary);mount(<ReportPanel/>)
  await screen.findByText('PHP 9,007,199,254,740,993.01')
  expect(screen.getByText(/1 with historical review · 1 without historical review/)).toBeTruthy()
  for(const name of ['Monthly','Inventory valuation','Gross profit estimate','Sales by product'])expect(screen.queryByRole('option',{name})).toBeNull()
  expect(screen.getByText('No matching report records.')).toBeTruthy()
})
test('admin can inspect unavailable profit with explicit cost coverage',async()=>{
  requestJson.mockImplementation(async path=>path.includes('/profit')?{sales_amount:'7.07',cost_amount:null,gross_profit:null,gross_margin_percent:null,unverified_lines:2,lines:3}:summary)
  mount(<ReportPanel/>,'admin');await screen.findByText('PHP 9,007,199,254,740,993.01')
  await userEvent.selectOptions(screen.getByLabelText('Report'),'profit')
  await screen.findByText(/2 sale lines lack an approved cost basis/)
  expect(screen.getAllByText('Unavailable')).toHaveLength(3)
})
test('report failure supports retry and exposes excluded record coverage',async()=>{
  requestJson.mockRejectedValueOnce(new Error('network')).mockResolvedValue({...summary,excluded_records:1})
  mount(<ReportPanel/>);await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button',{name:'Retry report'}))
  await screen.findByText(/1 sales records excluded/)
})
