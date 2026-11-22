import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import { useInventory } from '../inventory/useInventory'
import { fieldClass, secondaryClass, Paging, QueryState } from '../inventory/shared'
import { auditReference } from '../audit/reference'

export default function AuditLogs() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to={`/${user.role}`} replace />
  return <AdminAuditLogs />
}
function AdminAuditLogs() {
  const [query, setQuery] = useState({ q: '', module: '', page: 1 })
  const [draftModule, setDraftModule] = useState('')
  const [revision, setRevision] = useState(0)
  const result = useInventory(`/audit-logs?${new URLSearchParams({ ...query, limit: 20 })}`, revision)
  const modules = result.data?.modules || []
  return <Workspace>
    <PageHeading title="Audit logs" />
    <form className="mb-7 grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_auto]" onSubmit={event => {
      event.preventDefault(); const values = new FormData(event.currentTarget)
      setQuery({ q: values.get('q'), module: values.get('module'), page: 1 }); setRevision(value => value + 1)
    }}>
      <div className="sm:col-span-2 xl:col-span-1"><label htmlFor="audit-search" className="mb-2 block text-sm font-semibold">Search audit logs</label><input id="audit-search" name="q" maxLength={200} placeholder="Search user, action, module or recorded reference..." className={fieldClass} /></div>
      <div><label htmlFor="audit-module" className="mb-2 block text-sm font-semibold">Module</label><select id="audit-module" name="module" className={fieldClass} value={draftModule} onChange={event => setDraftModule(event.target.value)}><option value="">All modules</option>{draftModule && !modules.includes(draftModule) && <option value={draftModule}>{draftModule}</option>}{modules.map(module => <option key={module} value={module}>{module}</option>)}</select></div>
      <button className={secondaryClass}>Search</button>
    </form>
    <section className="table-frame" aria-label="Audit history" tabIndex={0}>
      <QueryState result={result} retry={() => setRevision(value => value + 1)} empty="No audit logs found" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <table className="audit-table" aria-describedby="audit-record-notes"><caption className="sr-only">Recorded audit events</caption><thead><tr>{['User','Action','Module','Reference','Time'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.data.map(row => <tr key={row.log_id}>
        <td><span className="font-semibold">{row.full_name || row.username || `User #${row.user_id}`}</span><div className="mt-1 text-xs text-slate-500">{row.username ? `${row.username} · ` : ''}User #{row.user_id}</div></td>
        <td>{row.action ?? 'Not recorded'}</td><td>{row.module ?? 'Not recorded'}</td><td>{auditReference(row) || '—'}</td><td className="tabular-nums">{row.logged_at ?? 'Not recorded'}</td>
      </tr>)}</tbody></table>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(current => ({ ...current, page }))} />}
    </section>
    <div id="audit-record-notes" className="mt-6 space-y-2 text-xs leading-relaxed text-slate-500"><p>Most recent activity first · Read-only history.</p><p>Actions, modules and timestamps are shown as recorded. Stored timestamps have no timezone attached; no timezone conversion is applied. User names come from current account records.</p><p>Reference is extracted only from recognized stored action formats; it is not a separate database field or a verified record relationship. A dash means no reference could be derived from a supported action format. Search matches stored text, not generated reference labels.</p></div>
  </Workspace>
}
