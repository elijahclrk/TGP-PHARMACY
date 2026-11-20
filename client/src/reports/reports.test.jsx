// @vitest-environment jsdom
import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {AuthContext} from '../auth/auth-context'
import {requestJson} from '../auth/api'
import ReportPanel from './ReportPanel'
import Dashboard from '../pages/Dashboard'
import {php,manilaDates} from './format'
vi.mock('../auth/api',()=>({requestJson:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
const summary={data:[],sales_amount:'9007199254740993.01',transactions:2,reviewed:1,unreviewed:1,excluded_records:0}
function mount(node,role='manager'){render(<MemoryRouter><AuthContext.Provider value={{user:{role,full_name:'Staff'},logout:vi.fn()}}>{node}</AuthContext.Provider></MemoryRouter>)}
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
test('manager sees reviewed/unreviewed totals but no monthly or admin options',async()=>{
  requestJson.mockResolvedValue(summary);mount(<ReportPanel/>)
  await screen.findByText('PHP 9,007,199,254,740,993.01')
  expect(screen.getByText(/1 reviewed · 1 unreviewed/)).toBeTruthy()
  for(const name of ['Monthly','Inventory valuation','Gross profit estimate','Sales by product'])expect(screen.queryByRole('option',{name})).toBeNull()
  expect(screen.getByText('No matching report records.')).toBeTruthy()
})
test('admin can inspect unavailable profit with explicit cost coverage',async()=>{
  requestJson.mockImplementation(async path=>path.includes('/profit')?{sales_amount:'7.07',cost_amount:null,gross_profit:null,gross_margin_percent:null,unverified_lines:2,lines:3}:summary)
  mount(<ReportPanel/>,'admin');await screen.findByText('PHP 9,007,199,254,740,993.01')
  await userEvent.selectOptions(screen.getByLabelText('Report'),'profit')
  await screen.findByText(/2 sale lines have unverified batch costs/)
  expect(screen.getAllByText('Unavailable')).toHaveLength(3)
})
test('report failure supports retry and exposes excluded record coverage',async()=>{
  requestJson.mockRejectedValueOnce(new Error('network')).mockResolvedValue({...summary,excluded_records:1})
  mount(<ReportPanel/>);await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button',{name:'Retry report'}))
  await screen.findByText(/1 sales records excluded/)
})
