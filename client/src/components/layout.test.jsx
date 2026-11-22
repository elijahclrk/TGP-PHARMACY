// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { requestJson } from '../auth/api'
import Workspace from './Workspace'
import Inventory from '../pages/Inventory'
import SalesChart from '../reports/SalesChart'

vi.mock('../auth/api', () => ({ requestJson: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
function mount(node, role = 'employee', path = '/employee') {
  return render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ user: { user_id: 1, role, username: 'test' }, logout: vi.fn() }}>{node}</AuthContext.Provider></MemoryRouter>)
}
test.each(['employee', 'manager', 'admin'])('%s sidebar follows existing permissions and never links to absent modules', role => {
  mount(<Workspace><h1>Test page</h1></Workspace>, role, `/${role}`)
  const navigation = within(screen.getByRole('navigation', { name: 'Workspace' }))
  expect(navigation.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page')
  expect(navigation.getByRole('link', { name: 'POS / Sales' }).getAttribute('href')).toBe('/pos')
  for (const name of ['Suppliers', 'Purchase orders', 'Stock-in', 'Sales Reports', 'Approvals']) {
    expect(Boolean(navigation.queryByRole('link', { name }))).toBe(role !== 'employee')
  }
  for (const name of ['Returns', 'Adjustments', 'Discount Rules']) {
    expect(navigation.queryByRole('link', { name })).toBeNull()
    expect(navigation.queryByRole('button', { name })).toBeNull()
  }
  expect(Boolean(navigation.queryByText('User accounts'))).toBe(role === 'admin')
  expect(Boolean(navigation.queryByRole('link', { name: 'User accounts' }))).toBe(role === 'admin')
  expect(Boolean(navigation.queryByRole('link', { name: 'Audit Logs' }))).toBe(role === 'admin')
  expect(Boolean(navigation.queryByRole('link', { name: 'Reorder Thresholds' }))).toBe(role === 'admin')
  expect(Boolean(navigation.queryByRole('link', { name: 'Notifications' }))).toBe(role === 'admin')
  expect(navigation.getByRole('link', { name: 'Alerts' }).getAttribute('href')).toBe('/alerts')
})
test('navigation opens, closes with Escape and restores keyboard focus', async () => {
  mount(<Workspace>Content</Workspace>)
  const button = screen.getByRole('button', { name: 'Menu' })
  expect(button.getAttribute('aria-expanded')).toBe('false')
  await userEvent.click(button)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  const dialog = screen.getByRole('dialog', { name: 'Workspace navigation' })
  expect(dialog.getAttribute('aria-modal')).toBe('true')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close navigation' }))
  expect(document.querySelector('.workspace-body').hasAttribute('inert')).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  screen.getByRole('link', { name: 'Products' }).focus()
  await userEvent.keyboard('{Escape}')
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(button)
  expect(document.querySelector('.workspace-body').hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('')
  expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe('#main-content')
})
test('mobile navigation contains Tab and programmatic focus; close button restores the opener', async () => {
  mount(<Workspace><button>Background action</button></Workspace>)
  const background = screen.getByRole('button', { name: 'Background action' })
  const opener = screen.getByRole('button', { name: 'Menu' })
  await userEvent.click(opener)
  const close = screen.getByRole('button', { name: 'Close navigation' })
  const last = screen.getByRole('button', { name: 'Sign out' })
  await userEvent.tab({ shift: true })
  expect(document.activeElement).toBe(last)
  await userEvent.tab()
  expect(document.activeElement).toBe(close)
  background.focus()
  expect(document.activeElement).toBe(close)
  await userEvent.click(close)
  expect(document.activeElement).toBe(opener)
  expect(screen.queryByRole('dialog')).toBeNull()
})
test('drawer dismisses on desktop resize without leaving the background inert or scroll locked', async () => {
  let resize
  const viewport = { matches: true, addEventListener: vi.fn((event, handler) => { resize = handler }), removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', vi.fn(() => viewport))
  const view = mount(<Workspace>Content</Workspace>)
  try {
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    viewport.matches = false
    const { act } = await import('@testing-library/react')
    await act(async () => resize({ matches: false }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('.workspace-body').hasAttribute('inert')).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Dashboard' }))
    view.unmount()
  } finally { vi.unstubAllGlobals() }
})
test('inventory expiry links retain batch navigation while the combined alert center has its own route', async () => {
  requestJson.mockResolvedValue({ data: [], total: 0, limit: 20, page: 1 })
  mount(<Inventory />, 'employee', '/inventory?status=near_expiry')
  await waitFor(() => expect(requestJson.mock.calls.some(([path]) => path.includes('status=near_expiry'))).toBe(true))
  expect(screen.getByLabelText('Expiry filter').value).toBe('near_expiry')
  expect(screen.getByRole('link', { name: 'Alerts' }).getAttribute('aria-current')).toBeNull()
  expect(screen.getByRole('link', { name: 'Batches' }).getAttribute('aria-current')).toBe('page')
  await userEvent.click(screen.getByRole('link', { name: 'Batches' }))
  await waitFor(() => expect(screen.getByLabelText('Expiry filter').value).toBe('all'))
  expect(screen.getByRole('link', { name: 'Batches' }).getAttribute('aria-current')).toBe('page')
  expect(requestJson.mock.calls.some(([path]) => path.includes('status=all'))).toBe(true)
})
test('sales trend uses actual exact decimal data and has an accessible text alternative', () => {
  render(<SalesChart rows={[{period_start:'2026-11-19',sales_amount:'9007199254740993.01'},{period_start:'2026-11-20',sales_amount:'4503599627370496.50'}]}/>)
  expect(screen.getAllByRole('listitem')[0].textContent).toBe('2026-11-19: PHP 9,007,199,254,740,993.01')
  const points = document.querySelectorAll('.sales-chart-point')
  expect(points[0].getAttribute('cy')).toBe('40')
  expect(Number(points[1].getAttribute('cy'))).toBeCloseTo(115.015)
})
test('sales trend has an honest empty state instead of sample chart values', () => {
  render(<SalesChart/>)
  expect(screen.getByText('No sales trend data for this range.')).toBeTruthy()
  expect(document.querySelector('.sales-area')).toBeNull()
})
