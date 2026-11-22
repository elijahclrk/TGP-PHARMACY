// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { requestJson } from '../auth/api'
import AuditLogs from '../pages/AuditLogs'
import { auditReference } from './reference'

vi.mock('../auth/api',()=>({requestJson:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
const row={log_id:1,user_id:2,username:'fixture_staff',full_name:'Fixture Staff',action:'sale.paid:25',module:'POS',logged_at:'2026-11-20 08:00:00.123456'}
const page=(data=[row])=>({data,total:data.length,page:1,limit:20,modules:['POS','accounts']})
function mount(role='admin') {
  return render(<MemoryRouter initialEntries={['/audit-logs']}><AuthContext.Provider value={{user:{user_id:1,role,username:'fixture_admin'},logout:vi.fn()}}><AuditLogs/></AuthContext.Provider></MemoryRouter>)
}
test('Admin audit table follows panel 17 and shows raw events/time with clearly derived reference',async()=>{
  requestJson.mockResolvedValue(page());mount()
  await screen.findByText('sale.paid:25')
  expect(within(screen.getByRole('table',{name:'Recorded audit events'})).getAllByRole('columnheader').map(cell=>cell.textContent)).toEqual(['User','Action','Module','Reference','Time'])
  expect(screen.getByText('Sale #25')).toBeTruthy();expect(screen.getByText(row.logged_at)).toBeTruthy()
  expect(screen.getByRole('link',{name:'Audit Logs'}).getAttribute('aria-current')).toBe('page')
  for(const name of [/Edit/,/Delete/,/Export/])expect(screen.queryByRole('button',{name})).toBeNull()
})
test.each(['employee','manager'])('%s cannot render audit controls or trigger audit requests',role=>{
  mount(role);expect(requestJson).not.toHaveBeenCalled();expect(screen.queryByLabelText('Search audit logs')).toBeNull()
})
test('audit search/module filters use stored values and persist during pagination, then reset page on search',async()=>{
  requestJson.mockImplementation(async path=>({...page(),total:21,page:Number(new URLSearchParams(path.split('?')[1]).get('page'))}))
  mount();await screen.findByText('sale.paid:25')
  await userEvent.type(screen.getByLabelText('Search audit logs'),'paid:25')
  await userEvent.selectOptions(screen.getByLabelText('Module'),'POS')
  await userEvent.click(screen.getByRole('button',{name:'Search'}))
  await waitFor(()=>expect(requestJson.mock.calls.at(-1)[0]).toContain('q=paid%3A25&module=POS&page=1'))
  await userEvent.click(await screen.findByRole('button',{name:'Next'}))
  await waitFor(()=>expect(requestJson.mock.calls.at(-1)[0]).toContain('module=POS&page=2'))
  expect(screen.getByLabelText('Module').value).toBe('POS')
  await userEvent.click(screen.getByRole('button',{name:'Search'}))
  await waitFor(()=>expect(requestJson.mock.calls.at(-1)[0]).toContain('module=POS&page=1'))
})
test('loading, failure/retry, empty datasets and previous/next controls remain honest',async()=>{
  requestJson.mockImplementationOnce(()=>new Promise(()=>{}));const view=mount()
  expect(screen.getByRole('status').textContent).toMatch(/Loading/);view.unmount()
  requestJson.mockRejectedValueOnce(new Error('network')).mockResolvedValue(page([]));mount()
  await screen.findByRole('alert');await userEvent.click(screen.getByRole('button',{name:'Try again'}))
  await screen.findByText('No audit logs found')
  expect(screen.getAllByRole('option')).toHaveLength(3)
  expect(screen.getByRole('button',{name:'Next'}).disabled).toBe(true)
  expect(screen.getByRole('button',{name:'Previous'}).disabled).toBe(true)
})
test('unknown legacy events are displayed without inventing references or executing markup',async()=>{
  requestJson.mockResolvedValue(page([{...row,action:'<img src=x onerror=alert(1)>',module:'constructor',logged_at:null}]));mount()
  await screen.findByText('<img src=x onerror=alert(1)>')
  expect(document.querySelector('img')).toBeNull();expect(screen.getByText('Not recorded')).toBeTruthy();expect(screen.getByText('—')).toBeTruthy()
})
test('reference extraction recognizes existing writer formats only, validates IDs and preserves module meaning',()=>{
  for(const [module,action,reference] of [
    ['accounts','account.created:2','User #2'],['inventory','batch.metadata_updated:7','Batch #7'],
    ['purchase_orders','orders.approved:4','PO #4'],['stock_in','receiving.created:5','Stock-in #5'],
    ['products','product.updated:8','Product #8'],['suppliers','suppliers.updated:9','Supplier #9'],
    ['product_images','product_image.saved:8:none:public-id','Product #8'],
  ])expect(auditReference({module,action})).toBe(reference)
  const id='11111111-1111-4111-8111-111111111111'
  expect(auditReference({module:'POS_checkout',action:'checkout.closed:'+id})).toBe('Checkout '+id)
  for(const item of [{module:'accounts',action:'auth.login'},{module:'POS',action:'orders.approved:4'},{module:'POS',action:'sale.paid:2147483648'},{module:'toString',action:'sale.paid:1'},{module:'POS',action:null}])expect(auditReference(item)).toBeNull()
})
