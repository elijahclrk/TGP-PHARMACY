// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { requestJson } from '../auth/api'
import Products from '../pages/Products'
import Inventory from '../pages/Inventory'
import ProductForm from './ProductForm'
import BatchForm from './BatchForm'

vi.mock('../auth/api', () => ({ requestJson: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const product = { product_id: 1, name: 'Test product', generic_name: 'Generic', category: null, unit_price: '10', qty_on_hand: '2', batch_count: 1, reorder_level: 5, low_stock: true }
const batch = { batch_id: 2, product_id: 1, product_name: 'Test product', batch_no: 'B1', qty_on_hand: 0, expiry_date: '2027-01-01', days_to_expiry: 10, cost_price: '6', selling_price: '10' }
const page = data => ({ data, total: data.length, page: 1, limit: 20 })
function mount(node, role = 'employee', path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ user: { role, full_name: 'Test Staff' }, logout: vi.fn() }}>{node}</AuthContext.Provider></MemoryRouter>)
}
test('employee product view supports search and shows low stock without edit controls', async () => {
  requestJson.mockResolvedValue(page([product]))
  const user = userEvent.setup()
  mount(<Products />)
  await screen.findByText('Test product')
  expect(screen.getByText('Low stock')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Add product' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull()
  await user.type(screen.getByLabelText('Search'), 'generic')
  await user.click(screen.getByRole('button', { name: 'Search products' }))
  await waitFor(() => expect(requestJson.mock.calls.filter(([path]) => path.startsWith('/products?')).at(-1)[0]).toContain('q=generic'))
})
test('loading, error retry and empty states are visible', async () => {
  requestJson.mockImplementationOnce(() => new Promise(() => {}))
  const view = mount(<Products />)
  expect(screen.getByRole('status').textContent).toMatch(/Loading/)
  view.unmount()
  requestJson.mockRejectedValueOnce(new Error('network')).mockResolvedValue(page([]))
  mount(<Products />)
  expect((await screen.findByRole('alert')).textContent).toContain('Unable to connect')
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('No products found')
})
test('employee never renders batch cost or edit controls even if supplied in data', async () => {
  requestJson.mockImplementation(async path => path.startsWith('/inventory') ? page([batch]) : page([product]))
  mount(<Inventory />)
  await screen.findByText('B1')
  expect(screen.queryByText('Cost price')).toBeNull()
  expect(screen.queryByRole('button', { name: /Edit batch/ })).toBeNull()
  expect(screen.getByText('Near expiry')).toBeTruthy()
})
test('manager can open zero-stock batch editor; expiry window is explicit', async () => {
  requestJson.mockImplementation(async path => path.startsWith('/inventory') ? page([batch]) : { data: product })
  const user = userEvent.setup()
  mount(<Inventory />, 'manager', '/inventory?product_id=1')
  await user.click(await screen.findByRole('button', { name: 'Add zero-stock batch' }))
  expect(screen.getByText(/Quantity is fixed at zero/)).toBeTruthy()
  expect(document.querySelector('input[name="qty_on_hand"]')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.selectOptions(screen.getByLabelText('Expiry filter'), 'near_expiry')
  await user.clear(screen.getByLabelText('Window (days)'))
  await user.type(screen.getByLabelText('Window (days)'), '7')
  await user.click(screen.getByRole('button', { name: 'Search batches' }))
  await waitFor(() => expect(requestJson.mock.calls.some(([path]) => path.includes('status=near_expiry&days=7'))).toBe(true))
})
test('batch submit sends metadata only, without any quantity', async () => {
  requestJson.mockResolvedValue({ data: batch })
  const saved = vi.fn()
  mount(<BatchForm batch={batch} productId="1" onSaved={saved} onCancel={vi.fn()} />, 'manager')
  await userEvent.click(screen.getByRole('button', { name: 'Save batch' }))
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())
  const [path, options] = requestJson.mock.calls[0]
  expect(path).toBe('/inventory/batches/2')
  expect(JSON.parse(options.body)).toEqual({ batch_no: 'B1', expiry_date: '2027-01-01', cost_price: '6', selling_price: '10' })
})
test('manager product submission excludes administrator reorder field', async () => {
  requestJson.mockResolvedValue({ data: product })
  mount(<ProductForm product={product} admin={false} onSaved={vi.fn()} onCancel={vi.fn()} />, 'manager')
  expect(screen.queryByLabelText('Reorder level')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Save product' }))
  expect(JSON.parse(requestJson.mock.calls[0][1].body)).not.toHaveProperty('reorder_level')
})
test('admin can set reorder level and save failures are displayed', async () => {
  requestJson.mockRejectedValue(Object.assign(new Error('Invalid request.'), { status: 400 }))
  mount(<ProductForm product={product} admin onSaved={vi.fn()} onCancel={vi.fn()} />, 'admin')
  expect(screen.getByLabelText('Reorder level').value).toBe('5')
  await userEvent.click(screen.getByRole('button', { name: 'Save product' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Invalid request.')
  expect(JSON.parse(requestJson.mock.calls[0][1].body).reorder_level).toBe(5)
})
