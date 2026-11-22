// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { requestJson } from '../auth/api'
import Purchasing from '../pages/Purchasing'
import PurchasingForm from './PurchasingForm'
import Workspace from '../components/Workspace'

vi.mock('../auth/api', () => ({ requestJson: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const supplier = { supplier_id: 1, name: 'Test supplier', contact_no: '555', address: 'Test address' }
const product = { product_id: 2, name: 'Test medicine' }
const page = data => ({ data, total: data.length, page: 1, limit: 20 })
function mount(node, role = 'manager') {
  return render(<MemoryRouter><AuthContext.Provider value={{ user: { role, full_name: 'Test Staff' }, logout: vi.fn() }}>{node}</AuthContext.Provider></MemoryRouter>)
}
test('supplier list, detail and edit preserve records without deletion', async () => {
  requestJson.mockImplementation(async (path, options) => options?.method === 'PATCH' ? { data: supplier } : path.includes('?') ? page([supplier]) : { data: supplier })
  const user = userEvent.setup()
  mount(<Purchasing kind="suppliers" />)
  await user.click(await screen.findByRole('button', { name: 'View record 1' }))
  await user.click(await screen.findByRole('button', { name: 'Edit supplier' }))
  expect(screen.getByLabelText('Supplier name').value).toBe('Test supplier')
  await user.clear(screen.getByLabelText('Supplier name'))
  await user.type(screen.getByLabelText('Supplier name'), 'Edited supplier')
  await user.click(screen.getByRole('button', { name: 'Save supplier' }))
  await screen.findByText('Supplier saved.')
  const call = requestJson.mock.calls.find(([, options]) => options?.method === 'PATCH')
  expect(call[0]).toBe('/suppliers/1')
  expect(JSON.parse(call[1].body).name).toBe('Edited supplier')
  expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
})
test('receiving form submits pending quantities, never approved state or on-hand stock', async () => {
  requestJson.mockImplementation(async (path, options) => options?.method === 'POST' ? { data: { stock_in_id: 9 } } : page(path.startsWith('/suppliers') ? [supplier] : [product]))
  const saved = vi.fn(), user = userEvent.setup()
  mount(<PurchasingForm kind="receiving" path="/stock-ins" onSaved={saved} onCancel={vi.fn()} />)
  await screen.findByRole('option', { name: 'Test supplier (#1)' })
  await user.selectOptions(screen.getByLabelText('Supplier', { selector: 'select' }), '1')
  await user.selectOptions(screen.getByLabelText('Product 1', { selector: 'select' }), '2')
  await user.type(screen.getByLabelText('Delivery reference'), 'REF-1')
  await user.type(screen.getByLabelText('Quantity 1'), '5')
  await user.type(screen.getByLabelText('Batch number 1'), 'B1')
  fireEvent.change(screen.getByLabelText('Expiry date 1'), { target: { value: '2028-01-01' } })
  await user.type(screen.getByLabelText('Cost price 1'), '4.25')
  await user.type(screen.getByLabelText('Selling price 1'), '6')
  const preview = within(screen.getByRole('region', { name: 'Draft receiving summary' }))
  expect(preview.getByText('PHP 21.25')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Save pending record' }))
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())
  const body = JSON.parse(requestJson.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)
  expect(body).toEqual({ supplier_id: 1, delivery_ref: 'REF-1', items: [{ product_id: 2, quantity: 5, batch_no: 'B1', expiry_date: '2028-01-01', cost_price: '4.25', selling_price: '6' }] })
})
test('receiving preview updates after cost, quantity and line removal without posting inventory', async () => {
  requestJson.mockResolvedValue(page([]))
  mount(<PurchasingForm kind="receiving" path="/stock-ins" onSaved={vi.fn()} onCancel={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Quantity 1'), '3')
  await user.type(screen.getByLabelText('Cost price 1'), '0.335')
  expect(within(screen.getByRole('region', {name:'Draft receiving summary'})).getByText('PHP 1.01')).toBeTruthy()
  await user.click(screen.getByRole('button', {name:'Add item'}))
  expect(within(screen.getByRole('region', {name:'Draft receiving summary'})).getByText('Unavailable')).toBeTruthy()
  await user.type(screen.getByLabelText('Quantity 2'), '2')
  await user.type(screen.getByLabelText('Cost price 2'), '1.0001')
  expect(within(screen.getByRole('region', {name:'Draft receiving summary'})).getByText('PHP 3.01')).toBeTruthy()
  await user.click(screen.getByRole('button', {name:'Remove item 2'}))
  expect(within(screen.getByRole('region', {name:'Draft receiving summary'})).getByText('PHP 1.01')).toBeTruthy()
  expect(requestJson.mock.calls.every(([,options])=>!options?.method)).toBe(true)
})
test('stock approval refreshes quantity and hides the posting action after success', async () => {
  let approved = false
  const record = () => ({ stock_in_id: 9, supplier_name: 'Test supplier', received_by: 2, approved_by: approved ? 2 : null, date_received: '2026-11-20T01:00:00Z', delivery_ref: 'REF',
    items: [{ item_id: 3, product_name: 'Test medicine', quantity: 5, unit_cost: '4', batch_no: 'B', expiry_date: '2028-01-01', qty_on_hand: approved ? 5 : 0 }], history: [] })
  requestJson.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') { approved = true; return { data: record() } }
    return path.includes('?') ? page([record()]) : { data: record() }
  })
  const user = userEvent.setup()
  mount(<Purchasing kind="receiving" />)
  await user.click(await screen.findByRole('button', { name: 'View record 9' }))
  await user.click(await screen.findByRole('button', { name: 'Approve and post stock' }))
  await screen.findByText('Approved. Stock posted successfully.')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve and post stock' })).toBeNull())
  expect(approved).toBe(true)
  const detail = screen.getByRole('region', { name: 'Record details' })
  expect(within(detail).getByText('User #2')).toBeTruthy()
})
test('purchase order editor has cost and quantity but no receiving fields', async () => {
  requestJson.mockResolvedValue(page([]))
  mount(<PurchasingForm kind="orders" path="/purchase-orders" onSaved={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByLabelText('Unit cost 1')).toBeTruthy()
  expect(screen.queryByLabelText('Delivery reference')).toBeNull()
  expect(screen.queryByLabelText('Expiry date 1')).toBeNull()
  await screen.findAllByText('No matches. Create a record first.')
})
test('new pages render errors, retry and empty state', async () => {
  let fail=true
  requestJson.mockImplementation(async path=>{if(path.startsWith('/purchase-orders?')&&fail){fail=false;throw new Error('network')}return page([])})
  mount(<Purchasing kind="orders" />)
  await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('No records found')
})
test('employee navigation hides supplier, purchase order and receiving links', () => {
  mount(<Workspace>Inventory view</Workspace>, 'employee')
  for (const name of ['Suppliers', 'Purchase orders', 'Stock-in']) expect(screen.queryByRole('link', { name })).toBeNull()
})
