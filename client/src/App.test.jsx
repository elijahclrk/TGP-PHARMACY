// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const session = role => ({ success: true, user: { user_id: 1, username: 'staff', full_name: 'Test Staff', role, status: 'active' }, expiresAt: Date.now() + 60000 })

describe('authentication routes', () => {
  test.each(['/suppliers', '/purchase-orders', '/stock-ins'])('employee cannot open management page %s directly', async path => {
    window.history.replaceState({}, '', path)
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, session('employee'))))
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/employee'))
    expect(screen.queryByRole('button', { name: /Add supplier|Record delivery|Create purchase order/ })).toBeNull()
  })
  test('anonymous direct dashboard access redirects to login without registration', async () => {
    window.history.replaceState({}, '', '/admin')
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, { message: 'Please sign in again.' })))
    render(<App />)
    await screen.findByRole('heading', { name: 'Sign in to your account' })
    expect(window.location.pathname).toBe('/login')
    expect(screen.queryByRole('link', { name: /register/i })).toBeNull()
  })
  test('invalid login displays safe error and retains login route', async () => {
    vi.stubGlobal('fetch', vi.fn(async path => reply(401, { message: path.endsWith('/login') ? 'Invalid username or password.' : 'Please sign in again.' })))
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Username'), 'staff')
    await user.type(screen.getByLabelText('Password'), 'incorrect')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid username or password.')
    expect(window.location.pathname).toBe('/login')
  })
  test.each(['admin', 'manager', 'employee'])('%s receives the correct placeholder after sign in; logout clears it', async role => {
    let signedIn = false
    const fetcher = vi.fn(async (path, options) => {
      expect(options.credentials).toBe('same-origin')
      if (path.endsWith('/login')) { signedIn = true; return reply(200, session(role)) }
      if (path.endsWith('/logout')) { signedIn = false; return reply(200, { success: true }) }
      return signedIn ? reply(200, session(role)) : reply(401, {})
    })
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Username'), 'staff')
    await user.type(screen.getByLabelText('Password'), 'test-only-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Welcome, Test Staff.' })
    expect(window.location.pathname).toBe('/' + role)
    expect(localStorage.length).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in to your account' })
    expect(window.location.pathname).toBe('/login')
  })
  test('employee cannot display the administrator placeholder by typing its URL', async () => {
    window.history.replaceState({}, '', '/admin')
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, session('employee'))))
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/employee'))
    expect(screen.getByText('Employee workspace')).toBeTruthy()
  })
})
