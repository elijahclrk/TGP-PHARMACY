import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { requestJson } from '../auth/api'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import Modal from '../components/Modal'
import { useInventory } from '../inventory/useInventory'
import { fieldClass, buttonClass, secondaryClass, Paging, QueryState } from '../inventory/shared'

export default function ReorderThresholds() {
  const { user } = useAuth()
  if (!user || user.role !== 'admin') return <Navigate to={user ? `/${user.role}` : '/login'} replace />
  return <ThresholdManagement />
}
function ThresholdManagement() {
  const [query, setQuery] = useState({ q: '', page: 1 })
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  const result = useInventory(`/products?${new URLSearchParams({ ...query, limit: 20 })}`, revision)
  const refresh = () => setRevision(value => value + 1)
  return <Workspace>
    <PageHeading title="Reorder thresholds" description="Set a separate reorder level for each product." />
    {notice && <p role="status" className="mb-5 text-green-800">{notice}</p>}
    <form className="mb-5 flex gap-3" onSubmit={event => { event.preventDefault(); setQuery({ q: new FormData(event.currentTarget).get('q'), page: 1 }) }}><label className="flex-1 text-sm font-semibold">Search thresholds<input name="q" maxLength={200} className={`${fieldClass} mt-2`} /></label><button className={`${secondaryClass} self-end`}>Search thresholds</button></form>
    <section className="table-frame" aria-label="Product reorder thresholds"><QueryState result={result} retry={refresh} empty="No products found" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <table><thead><tr>{['Product', 'Recorded stock', 'Reorder level', 'Status', 'Action'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.data.map(row => <tr key={row.product_id}><td>{row.name}</td><td>{row.qty_on_hand ?? 'Unknown'}</td><td>{row.reorder_level ?? 'Unset'}</td><td>{row.reorder_level === null ? 'Not evaluated — threshold unset' : row.low_stock === null ? 'Quantity unknown' : row.low_stock ? 'Low stock' : 'Above reorder level'}</td><td><button className="font-semibold text-red-700" aria-label={`Edit threshold for ${row.name}`} onClick={() => { setSelected(row); setNotice('') }}>Edit</button></td></tr>)}</tbody></table>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(current => ({ ...current, page }))} />}
    </section>
    <p className="mt-5 text-sm text-slate-500">A blank threshold is unset and produces no low-stock evaluation. Zero is a valid explicit threshold. Comparisons include all recorded batch quantities. No critical-stock level is calculated.</p>
    {selected && <ThresholdEditor key={selected.product_id} product={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setNotice('Reorder threshold saved.'); refresh() }} />}
  </Workspace>
}
function ThresholdEditor({ product, onClose, onSaved }) {
  const [value, setValue] = useState(product.reorder_level === null ? '' : String(product.reorder_level))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (value !== '' && (!/^\d+$/.test(value) || Number(value) > 2147483647)) throw new Error('Use a nonnegative whole number or leave the threshold blank.')
      await requestJson(`/products/${product.product_id}`, { method: 'PATCH', body: JSON.stringify({ reorder_level: value === '' ? null : Number(value) }) })
      onSaved()
    } catch (failure) { setError(failure.status ? failure.message : 'The threshold could not be confirmed. Close and refresh before retrying.') }
    finally { setBusy(false) }
  }
  return <Modal title="Update reorder threshold" onClose={onClose} busy={busy}><form onSubmit={save}><p className="mb-4 font-semibold">{product.name}</p><label className="text-sm font-semibold">Reorder level<input className={`${fieldClass} mt-2`} type="number" min="0" max="2147483647" step="1" value={value} disabled={busy} onChange={event => setValue(event.target.value)} /></label><p className="my-4 text-sm text-slate-500">Leave blank to explicitly unset this product's threshold.</p>{error && <p role="alert" className="mb-4 text-red-800">{error}</p>}<button className={buttonClass} disabled={busy}>{busy ? 'Saving...' : 'Save threshold'}</button></form></Modal>
}
