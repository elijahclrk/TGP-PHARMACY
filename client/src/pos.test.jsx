// @vitest-environment jsdom
import { afterEach,expect,test,vi } from 'vitest'
import { cleanup,render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from './auth/auth-context'
import { requestJson } from './auth/api'
import Pos from './pages/Pos'
import { clearCheckout } from './checkout-recovery'

vi.mock('./auth/api',()=>({ requestJson:vi.fn() }))
afterEach(()=>{cleanup();localStorage.clear();vi.resetAllMocks()})
const product={ product_id:1,name:'Test medicine',generic_name:'Generic',unit_price:'1.01',available:'5' }
const quote={items:[{...product,quantity:1,line_total:'1.01'}],total:'1.01',quote_token:'server-signed-test-quote'}
const receipt={sale_id:1,receipt_no:'POS-test',username:'cashier',sale_date:'2026-11-20T01:00:00Z',total_amount:'1.01',items:[{sale_item_id:1,product_name:'Test medicine',batch_no:'B1',expiry_date:'2028-01-01',quantity:1,unit_price:'1.01',line_total:'1.01'}],payments:[{amount_paid:'2.00',change_due:'0.99'}]}
function mount(role='employee') {render(<MemoryRouter><AuthContext.Provider value={{user:{user_id:3,role,full_name:'Cashier'},logout:vi.fn()}}><Pos /></AuthContext.Provider></MemoryRouter>)}
function mockApi(checkout) {requestJson.mockImplementation(async(path,options)=>path==='/pos/checkout' ? checkout(options) : path==='/pos/quote' ? {data:quote} : {data:[product],total:1,page:1,limit:20})}
async function ready(user) {
  await user.click(await screen.findByRole('button',{name:'Add Test medicine'}))
  await user.click(screen.getByRole('button',{name:'Review total'}))
  await screen.findByText('Total: PHP 1.01')
  await user.type(screen.getByLabelText('Cash received (PHP)'),'2.00')
}
test.each(['employee','manager','admin'])('%s can check out with server quote and stored receipt',async role=>{
  mockApi(async()=>({data:{receipt,replayed:false}}));const user=userEvent.setup();mount(role)
  expect(screen.getByText(/Senior Citizen\/PWD discounted checkout is unavailable/)).toBeTruthy()
  await ready(user);await user.click(screen.getByRole('button',{name:'Complete cash sale'}))
  await screen.findByRole('heading',{name:'Transaction complete'})
  expect(screen.getByText(/Change: PHP 0.99/)).toBeTruthy()
  const body=JSON.parse(requestJson.mock.calls.find(([path])=>path==='/pos/checkout')[1].body)
  expect(body.items).toEqual([{product_id:1,quantity:1}]);expect(body.amount_paid).toBe('2.00')
  expect(body.quote_token).toBe(quote.quote_token)
  expect(body).not.toHaveProperty('total_amount');expect(body).not.toHaveProperty('discount_id');expect(body.request_id).toMatch(/^[a-f0-9-]{36}$/)
})

test('receipt dialog can be closed and reopened without creating another checkout',async()=>{
  mockApi(async()=>({data:{receipt,replayed:false}}));const user=userEvent.setup();mount()
  await ready(user);await user.click(screen.getByRole('button',{name:'Complete cash sale'}))
  await screen.findByRole('dialog',{name:'Transaction complete'})
  await user.click(screen.getByRole('button',{name:'Back to POS'}))
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button',{name:'Last receipt'}))
  expect(screen.getByRole('region',{name:'Receipt'}).textContent).toContain('POS-test')
  expect(requestJson.mock.calls.filter(([path])=>path==='/pos/checkout')).toHaveLength(1)
})
test('network uncertainty freezes cart and retries the identical request',async()=>{
  let attempts=0;mockApi(async()=>{if(++attempts===1)throw new Error('network');return {data:{receipt,replayed:true}}})
  const user=userEvent.setup();mount();await ready(user)
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}))
  await screen.findByText(/Checkout outcome is uncertain/)
  expect(screen.getByRole('button',{name:'Add Test medicine'}).disabled).toBe(true)
  await user.click(screen.getByRole('button',{name:'Retry same checkout'}))
  await screen.findByRole('heading',{name:'Transaction complete'})
  const calls=requestJson.mock.calls.filter(([path])=>path==='/pos/checkout')
  expect(calls[0][1].body).toBe(calls[1][1].body)
})
test('insufficient cash shows server error without confirming sale',async()=>{
  mockApi(async()=>{throw Object.assign(new Error('Cash received must cover the full total.'),{status:422})})
  const user=userEvent.setup();mount();await ready(user)
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}))
  expect((await screen.findByRole('alert')).textContent).toMatch(/cover the full total/)
  expect(screen.queryByRole('heading',{name:'Transaction complete'})).toBeNull()
  expect(screen.getByLabelText('Cash received (PHP)').disabled).toBe(true)
})
test('cart change invalidates quoted total and search uses the POS endpoint',async()=>{
  mockApi(async()=>({data:{receipt}}));const user=userEvent.setup();mount();await ready(user)
  await user.clear(screen.getByLabelText('Quantity for Test medicine'))
  await user.type(screen.getByLabelText('Quantity for Test medicine'),'2')
  expect(screen.queryByText('Total: PHP 1.01')).toBeNull()
  await user.type(screen.getByLabelText('Search POS products'),'Generic')
  await user.click(screen.getByRole('button',{name:'Search'}))
  await waitFor(()=>expect(requestJson.mock.calls.some(([path])=>path.includes('q=Generic'))).toBe(true))
})
test('refresh after lost commit response recovers stored receipt without a second POST',async()=>{
  mockApi(async()=>{throw new Error('lost response')});const user=userEvent.setup();mount();await ready(user)
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}));await screen.findByText(/Checkout outcome is uncertain/)
  const saved=localStorage.getItem('tgp.checkout.v1.3');expect(saved).toBeTruthy()
  cleanup();requestJson.mockImplementation(async path=>path.startsWith('/pos/checkouts/')?{data:{status:'completed',receipt}}:{data:[product],total:1,page:1,limit:20})
  mount();await user.click(await screen.findByRole('button',{name:'Check transaction status'}))
  await screen.findByRole('heading',{name:'Transaction complete'})
  expect(localStorage.getItem('tgp.checkout.v1.3')).toBeNull()
  expect(requestJson.mock.calls.filter(([path])=>path==='/pos/checkout')).toHaveLength(1)
})
test('storage failure blocks checkout before HTTP submission',async()=>{
  mockApi(async()=>({data:{receipt}}));const user=userEvent.setup();mount();await ready(user)
  const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota')})
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}));await screen.findByRole('alert')
  expect(requestJson.mock.calls.filter(([path])=>path==='/pos/checkout')).toHaveLength(0)
  spy.mockRestore()
})

test('confirmed underpayment closure unlocks correction and uses a new reference only after review',async()=>{
  let calls=0
  mockApi(async()=>{if(++calls===1)throw Object.assign(new Error('Cash received must cover the full total.'),{status:422,checkoutState:'closed'});return {data:{receipt,replayed:false}}})
  const user=userEvent.setup();mount();await ready(user)
  await user.clear(screen.getByLabelText('Cash received (PHP)'));await user.type(screen.getByLabelText('Cash received (PHP)'),'0.50')
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}))
  expect((await screen.findByRole('alert')).textContent).toContain('closed without a sale')
  expect(screen.getByLabelText('Quantity for Test medicine').disabled).toBe(false)
  expect(screen.queryByLabelText('Saved checkout')).toBeNull();expect(localStorage.getItem('tgp.checkout.v1.3')).toBeNull()
  expect(screen.queryByRole('button',{name:'Complete cash sale'})).toBeNull()
  await user.click(screen.getByRole('button',{name:'Review total'}))
  const cash=await screen.findByLabelText('Cash received (PHP)');await user.clear(cash);await user.type(cash,'2.00')
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}));await screen.findByRole('heading',{name:'Transaction complete'})
  const sent=requestJson.mock.calls.filter(([path])=>path==='/pos/checkout').map(([,options])=>JSON.parse(options.body))
  expect(sent).toHaveLength(2);expect(sent[0].request_id).not.toBe(sent[1].request_id)
  expect(sent[0].amount_paid).toBe('0.50');expect(sent[1].amount_paid).toBe('2.00')
})
test('confirmed stock rejection restores editable cart and requires another quote',async()=>{
  mockApi(async()=>{throw Object.assign(new Error('Stock changed'),{status:409,checkoutState:'closed'})})
  const user=userEvent.setup();mount();await ready(user);await user.click(screen.getByRole('button',{name:'Complete cash sale'}))
  await screen.findByText(/closed without a sale/)
  expect(screen.getByLabelText('Quantity for Test medicine').disabled).toBe(false)
  expect(screen.queryByText('Total: PHP 1.01')).toBeNull()
  await user.click(screen.getByRole('button',{name:'Remove Test medicine'}));expect(screen.getByText('Add a product to begin.')).toBeTruthy()
})
test('not_found never unlocks uncertainty; explicit resolution closes saved reference after refresh',async()=>{
  mockApi(async()=>{throw Error('network')});const user=userEvent.setup();mount();await ready(user)
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}));await screen.findByText(/Checkout outcome is uncertain/)
  cleanup()
  requestJson.mockImplementation(async(path)=>path.endsWith('/resolve')?{data:{status:'closed'}}:path.startsWith('/pos/checkouts/')?{data:{status:'not_found'}}:{data:[product],total:1,page:1,limit:20})
  mount();await user.click(await screen.findByRole('button',{name:'Check transaction status'}))
  await screen.findByText(/This alone does not prove failure/)
  expect(screen.getByRole('button',{name:'Add Test medicine'}).disabled).toBe(true)
  await user.click(screen.getByRole('button',{name:'Resolve for editing'}));await screen.findByText(/closed without a sale/)
  expect(screen.getByRole('button',{name:'Add Test medicine'}).disabled).toBe(false)
  expect(localStorage.getItem('tgp.checkout.v1.3')).toBeNull()
  expect(requestJson.mock.calls.filter(([path])=>path==='/pos/checkout')).toHaveLength(1)
})
test('resolution after a lost paid response shows the original receipt instead of editing',async()=>{
  mockApi(async()=>{throw Error('lost response')});const user=userEvent.setup();mount();await ready(user)
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}));await screen.findByText(/Checkout outcome is uncertain/)
  requestJson.mockImplementation(async path=>path.endsWith('/resolve')?{data:{status:'completed',receipt}}:{data:[product],total:1,page:1,limit:20})
  await user.click(screen.getByRole('button',{name:'Resolve for editing'}));await screen.findByRole('heading',{name:'Transaction complete'})
  expect(screen.queryByLabelText('Saved checkout')).toBeNull()
  expect(requestJson.mock.calls.filter(([path])=>path==='/pos/checkout')).toHaveLength(1)
})
test('clearing a resolved checkout cannot remove another saved reference',()=>{
  const other={request_id:crypto.randomUUID(),amount_paid:'2.00',items:[]}
  localStorage.setItem('tgp.checkout.v1.3',JSON.stringify(other))
  expect(()=>clearCheckout(3,crypto.randomUUID())).toThrow('Another saved checkout')
  expect(JSON.parse(localStorage.getItem('tgp.checkout.v1.3'))).toEqual(other)
})

test('price-change closure requires an explicit fresh quote and sends its new token', async () => {
  let checkouts=0, reviews=0
  requestJson.mockImplementation(async path => {
    if (path==='/pos/quote') return {data:{...quote,quote_token:++reviews===1?'old-review':'fresh-review'}}
    if (path==='/pos/checkout') {
      if (++checkouts===1) throw Object.assign(new Error('Quote changed'),{status:409,checkoutState:'closed'})
      return {data:{receipt,replayed:false}}
    }
    return {data:[product],total:1,page:1,limit:20}
  })
  const user=userEvent.setup();mount();await ready(user)
  await user.click(screen.getByRole('button',{name:'Complete cash sale'}))
  await screen.findByText(/closed without a sale/)
  expect(reviews).toBe(1);expect(screen.queryByRole('button',{name:'Complete cash sale'})).toBeNull()
  await user.click(screen.getByRole('button',{name:'Review total'}))
  await user.click(await screen.findByRole('button',{name:'Complete cash sale'}))
  await screen.findByRole('heading',{name:'Transaction complete'})
  const sent=requestJson.mock.calls.filter(([path])=>path==='/pos/checkout').map(([,o])=>JSON.parse(o.body))
  expect(sent.map(body=>body.quote_token)).toEqual(['old-review','fresh-review'])
  expect(sent[0].request_id).not.toBe(sent[1].request_id)
})
