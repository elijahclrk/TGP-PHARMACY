import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import { useInventory } from '../inventory/useInventory'
import { fieldClass, buttonClass, secondaryClass, Paging, QueryState } from '../inventory/shared'
import AccountForm from '../accounts/AccountForm'
import AccountDetails from '../accounts/AccountDetails'
import { roleLabel, statusLabel } from '../accounts/labels'
import Icon from '../components/Icon'

export default function Users() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to={`/${user.role}`} replace />
  return <AdminUsers currentUser={user} />
}
function AdminUsers({ currentUser }) {
  const [query, setQuery] = useState({ q: '', page: 1 })
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState(false)
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  const result = useInventory(`/auth/users?${new URLSearchParams({ ...query, limit: 20 })}`, revision)
  function refresh() { setRevision(value => value + 1) }
  return <Workspace>
    <PageHeading title="User accounts" action={<button type="button" className={buttonClass} onClick={() => { setEditor(true); setNotice('') }}><Icon name="plus" />Add user</button>} />
    {notice && <p role="status" className="mb-5 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    {editor && <AccountForm onCancel={() => setEditor(false)} onSaved={user => { setEditor(false); setSelected(user.user_id); setNotice('Account created.'); refresh() }} />}
    <form className="mb-6 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setQuery({ q: new FormData(event.currentTarget).get('q'), page: 1 }); refresh() }}>
      <div className="min-w-40 flex-1"><label htmlFor="account-search" className="mb-2 block text-sm font-semibold">Search users</label><input id="account-search" name="q" maxLength={200} placeholder="Name or username..." className={fieldClass} /></div>
      <button className={secondaryClass}>Search users</button><button type="button" className={secondaryClass} onClick={refresh}>Refresh accounts</button>
    </form>
    <section className="table-frame" aria-label="User accounts list">
      <QueryState result={result} retry={refresh} empty="No accounts found" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <table><caption className="sr-only">Staff accounts</caption><thead><tr>{['User','Username','Role','Status'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.data.map(user => <tr key={user.user_id}>
        <td><button className="text-left font-semibold text-red-700 underline underline-offset-4" aria-label={`View account ${user.username}`} onClick={() => setSelected(user.user_id)}>{user.full_name || user.username}</button></td><td>{user.username}</td><td>{roleLabel(user.role)}</td><td><span className={`rounded px-2 py-1 text-xs font-semibold ${user.status === 'active' ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{statusLabel(user.status)}</span></td>
      </tr>)}</tbody></table>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(current => ({ ...current, page }))} />}
    </section>
    {selected && <AccountDetails key={selected} id={selected} revision={revision} currentUserId={currentUser.user_id} onClose={() => setSelected(null)} onDeactivated={() => { setNotice('Account deactivated. Active sessions revoked.'); refresh() }} />}
    <section className="surface mt-8"><h2 className="font-semibold">Access follows the assigned role.</h2><p className="mt-3 text-sm text-slate-600">Admin manages Employee and Manager accounts. Employees have no user-management or sales-report access. Existing account history is retained.</p></section>
  </Workspace>
}
