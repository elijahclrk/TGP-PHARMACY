import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import Brand from './Brand'
import { useAuth } from '../auth/auth-context'

export default function Workspace({ children }) {
  const { user, logout } = useAuth()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function signOut() {
    setPending(true)
    try { await logout() } catch { setError('Sign out could not be confirmed. Please try again.') }
    finally { setPending(false) }
  }
  return <div className="min-h-svh bg-slate-50 font-sans text-slate-900">
    <header className="border-b border-green-100 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5">
      <Brand /><div className="flex items-center gap-5"><span className="text-sm text-slate-600">{user.full_name || user.username} <span className="ml-2 rounded-full bg-green-50 px-2 py-1 capitalize text-green-800">{user.role}</span></span>
        <button onClick={signOut} disabled={pending} className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50">{pending ? 'Signing out…' : 'Sign out'}</button></div>
    </div></header>
    <nav aria-label="Workspace" className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-6">
      {[[`/${user.role}`, 'Overview'], ['/pos', 'POS'], ['/products', 'Products'], ['/inventory', 'Inventory'], ...(['admin', 'manager'].includes(user.role) ? [['/reports', 'Reports'], ['/suppliers', 'Suppliers'], ['/purchase-orders', 'Purchase orders'], ['/stock-ins', 'Stock-in']] : [])].map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `shrink-0 border-b-2 py-4 text-sm font-semibold ${isActive ? 'border-green-700 text-green-800' : 'border-transparent text-slate-500 hover:text-green-800'}`}>{label}</NavLink>)}
    </div></nav>
    <main className="mx-auto max-w-7xl px-6 py-10">{error && <p role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}{children}</main>
  </div>
}
