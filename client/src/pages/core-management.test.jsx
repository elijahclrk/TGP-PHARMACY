// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { requestJson } from '../auth/api'
import Alerts from './Alerts'
import Approvals from './Approvals'
import ReorderThresholds from './ReorderThresholds'

vi.mock('../auth/api', () => ({ requestJson: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const page = data => ({ data, total: data.length, page: 1, limit: 20, business_date: '2026-11-21', near_expiry_through: '2027-02-21' })
function mount(node, role = 'admin') { return render(<MemoryRouter><AuthContext.Provider value={{ user: { user_id: 1, role, username: 'staff' }, logout: vi.fn() }}>{node}</AuthContext.Provider></MemoryRouter>) }

test('combined alerts are read-only for Employees and separate today, expired and upcoming batches', async () => {
  requestJson.mockImplementation(async path => path.startsWith('/products') ? page([{ product_id: 1, name: 'Low medicine', qty_on_hand: '1', reorder_level: 2 }]) : page([{ batch_id: 2, product_name: 'Expiry medicine', batch_no: 'B2', expiry_date: '2026-11-21', qty_on_hand: 3, expiry_status: path.includes('expiring_today') ? 'expiring_today' : path.includes('status=expired') ? 'expired' : 'near_expiry' }]))
  mount(<Alerts />, 'employee')
  await screen.findByText('Low medicine')
  expect(screen.getByText(/2026-11-21 through 2027-02-21/)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Expires today (1)' }))
  await screen.findByText('Expires today — not sellable')
  await userEvent.click(screen.getByRole('button', { name: 'Expired (1)' }))
  expect((await screen.findByRole('region', { name: 'Expired' })).textContent).toContain('Expired')
  await userEvent.click(screen.getByRole('button', { name: 'Upcoming expiry (1)' }))
  expect((await screen.findByRole('region', { name: 'Upcoming expiry' })).textContent).toContain('Upcoming expiry')
  expect(requestJson.mock.calls.every(([path, options]) => !path.includes('days=') && !options.method)).toBe(true)
})

test.each(['employee', 'manager'])('%s cannot load Admin threshold management', role => {
  mount(<ReorderThresholds />, role)
  expect(requestJson).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: 'Reorder thresholds' })).toBeNull()
})

test('Admin threshold view distinguishes unset from zero and sends only the authorized threshold field', async () => {
  const product = { product_id: 4, name: 'Unset medicine', qty_on_hand: '2', reorder_level: null, low_stock: null }
  requestJson.mockImplementation(async (_path, options) => options.method ? { data: product } : page([product]))
  mount(<ReorderThresholds />)
  await screen.findByText('Not evaluated — threshold unset')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Edit threshold for Unset medicine' }))
  expect(screen.getByLabelText('Reorder level').value).toBe('')
  await user.type(screen.getByLabelText('Reorder level'), '0')
  await user.click(screen.getByRole('button', { name: 'Save threshold' }))
  await screen.findByText('Reorder threshold saved.')
  const mutation = requestJson.mock.calls.find(([, options]) => options.method === 'PATCH')
  expect(mutation[0]).toBe('/products/4'); expect(JSON.parse(mutation[1].body)).toEqual({ reorder_level: 0 })
  await user.click(screen.getByRole('button', { name: 'Edit threshold for Unset medicine' }))
  await user.click(screen.getByRole('button', { name: 'Save threshold' }))
  await waitFor(() => expect(requestJson.mock.calls.filter(([, options]) => options.method === 'PATCH')).toHaveLength(2))
  expect(JSON.parse(requestJson.mock.calls.filter(([, options]) => options.method === 'PATCH')[1][1].body)).toEqual({ reorder_level: null })
})

test.each(['manager', 'admin'])('%s consolidated approvals reuse PO/stock-in details and existing once-only operations', async role => {
  const order = { po_id: 5, supplier_name: 'Recorded supplier', created_by: 1, approved_by: null, items: [], history: [] }
  const stock = { stock_in_id: 6, supplier_name: 'Recorded supplier', received_by: 1, approved_by: null, items: [], history: [] }
  requestJson.mockImplementation(async (path, options) => {
    if (options.method === 'POST') return { data: {} }
    if (path === '/purchase-orders/5') return { data: order }
    if (path === '/stock-ins/6') return { data: stock }
    return page([path.startsWith('/purchase-orders') ? order : stock])
  })
  mount(<Approvals />, role)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Review purchase order 5' }))
  await user.click(await screen.findByRole('button', { name: 'Approve purchase order' }))
  await waitFor(() => expect(requestJson.mock.calls.some(([path, options]) => path === '/purchase-orders/5/approve' && options.method === 'POST')).toBe(true))
  await user.click(screen.getByRole('button', { name: 'Stock-in (1)' }))
  await user.click(await screen.findByRole('button', { name: 'Review stock-in 6' }))
  await user.click(await screen.findByRole('button', { name: 'Approve and post stock' }))
  await waitFor(() => expect(requestJson.mock.calls.some(([path, options]) => path === '/stock-ins/6/approve' && options.body === '{}')).toBe(true))
  expect(screen.queryByRole('button', { name: /Reject/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Approved' }))
  await waitFor(() => expect(requestJson.mock.calls.some(([path]) => path.includes('status=approved'))).toBe(true))
})

test('Employee cannot load consolidated approval records', () => {
  mount(<Approvals />, 'employee'); expect(requestJson).not.toHaveBeenCalled()
})
