// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const session = role => ({ success: true, user: { user_id: 1, username: 'staff', full_name: 'Test Staff', role, status: 'active' }, expiresAt: Date.now() + 60000 })

describe('authentication routes', () => {
  test.each(['employee','manager'])('%s cannot open the Admin audit route', async role => {
    window.history.replaceState({}, '', '/audit-logs')
    const fetcher=vi.fn(async()=>reply(200,session(role)))
    vi.stubGlobal('fetch',fetcher);render(<App/>)
    await waitFor(()=>expect(window.location.pathname).toBe('/'+role))
    expect(fetcher.mock.calls.some(([path])=>String(path).startsWith('/api/audit-logs'))).toBe(false)
    expect(screen.queryByLabelText('Search audit logs')).toBeNull()
  })
  test('Admin direct audit route loads the protected read-only page', async () => {
    window.history.replaceState({}, '', '/audit-logs')
    vi.stubGlobal('fetch',vi.fn(async path=>reply(200,String(path).includes('/audit-logs')?{data:[],total:0,page:1,limit:20,modules:[]}:session('admin'))))
    render(<App/>);await screen.findByRole('heading',{name:'Audit logs'});await screen.findByText('No audit logs found')
  })
  test.each(['employee','manager'])('%s cannot open User accounts by typing its URL', async role => {
    window.history.replaceState({}, '', '/users')
    const fetcher=vi.fn(async()=>reply(200,session(role)))
    vi.stubGlobal('fetch',fetcher)
    render(<App/>)
    await waitFor(()=>expect(window.location.pathname).toBe('/'+role))
    expect(fetcher.mock.calls.some(([path])=>String(path).startsWith('/api/auth/users'))).toBe(false)
    expect(screen.queryByRole('button',{name:'Add user'})).toBeNull()
  })
  test('Admin direct User accounts route loads the protected list', async () => {
    window.history.replaceState({}, '', '/users')
    vi.stubGlobal('fetch',vi.fn(async path=>reply(200,String(path).includes('/auth/users')?{data:[],total:0,page:1,limit:20}:session('admin'))))
    render(<App/>)
    await screen.findByRole('heading',{name:'User accounts'})
    await screen.findByText('No accounts found')
    expect(window.location.pathname).toBe('/users')
  })
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
    await screen.findByRole('heading', { name: 'Welcome back.' })
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
  test.each(['admin', 'manager', 'employee'])('%s receives the correct dashboard after sign in; logout clears it', async role => {
    let signedIn = false
    const fetcher = vi.fn(async (path, options) => {
      expect(options.credentials).toBe('same-origin')
      if (path.endsWith('/login')) {
        expect(JSON.parse(options.body)).toEqual({ username: 'staff', password: 'test-only-password' })
        signedIn = true; return reply(200, session(role))
      }
      if (path.endsWith('/logout')) { signedIn = false; return reply(200, { success: true }) }
      return signedIn ? reply(200, session(role)) : reply(401, {})
    })
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Username'), 'staff')
    await user.type(screen.getByLabelText('Password'), 'test-only-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Your pharmacy, at a glance.' })
    expect(screen.getByText(/Welcome, Test Staff\./)).toBeTruthy()
    expect(window.location.pathname).toBe('/' + role)
    expect(localStorage.length).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Welcome back.' })
    expect(window.location.pathname).toBe('/login')
  })
  test('employee cannot display the administrator dashboard by typing its URL', async () => {
    window.history.replaceState({}, '', '/admin')
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, session('employee'))))
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/employee'))
    expect(screen.getByText(/Employee workspace/)).toBeTruthy()
  })
})
