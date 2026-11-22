import { useState } from 'react'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import { useInventory } from '../inventory/useInventory'
import { ExpiryBadge, Paging, QueryState, secondaryClass } from '../inventory/shared'

const tabs = [['low', 'Low stock'], ['near_expiry', 'Upcoming expiry'], ['expiring_today', 'Expires today'], ['expired', 'Expired']]
export default function Alerts() {
  const [active, setActive] = useState('low')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const low = useInventory(`/products?stock=low&limit=20&page=${active === 'low' ? page : 1}`, revision)
  const upcoming = useInventory(`/inventory/batches?status=near_expiry&limit=20&page=${active === 'near_expiry' ? page : 1}`, revision)
  const today = useInventory(`/inventory/batches?status=expiring_today&limit=20&page=${active === 'expiring_today' ? page : 1}`, revision)
  const expired = useInventory(`/inventory/batches?status=expired&limit=20&page=${active === 'expired' ? page : 1}`, revision)
  const results = { low, near_expiry: upcoming, expiring_today: today, expired }
  const result = results[active]
  const refresh = () => setRevision(value => value + 1)
  return <Workspace>
    <PageHeading title="Stock alerts" description="Review recorded stock and batch expiry." action={<button className={secondaryClass} onClick={refresh}>Refresh alerts</button>} />
    <p className="mb-5 text-sm text-slate-600">Upcoming expiry covers dates after today through three calendar months from the Asia/Manila business date{result.data?.near_expiry_through ? ` (${result.data.business_date} through ${result.data.near_expiry_through})` : ''}. Expired and expiring-today batches cannot be sold.</p>
    <div className="mb-5 flex flex-wrap gap-3" role="group" aria-label="Alert categories">{tabs.map(([key, label]) => <button key={key} className={secondaryClass} aria-pressed={active === key} onClick={() => { setActive(key); setPage(1) }}>{label}{!results[key].loading && !results[key].error ? ` (${results[key].data.total})` : ''}</button>)}</div>
    <section className="table-frame" aria-label={tabs.find(([key]) => key === active)[1]}>
      <QueryState result={result} retry={refresh} empty="No matching alerts" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <table><thead><tr>{(active === 'low' ? ['Product', 'Recorded stock / within-date stock', 'Reorder level'] : ['Product / batch', 'Expiry date', 'Recorded stock', 'Status']).map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{result.data.data.map(row => active === 'low' ? <tr key={row.product_id}><td>{row.name}</td><td>{row.qty_on_hand ?? 'Unknown'} recorded · {row.within_date_qty??'Unknown'} within-date (expiry only)</td><td>{row.reorder_level ?? 'Unset'}</td></tr> : <tr key={row.batch_id}><td>{row.product_name}<small className="block text-slate-500">{row.batch_no}</small></td><td>{row.expiry_date}</td><td>{row.qty_on_hand ?? 'Unknown'}</td><td><ExpiryBadge batch={row} /></td></tr>)}</tbody></table>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={setPage} />}
    </section>
    <p className="mt-5 text-sm text-slate-500">Low-stock comparisons use all recorded batches, including expired quantities. Unset thresholds are not evaluated. This view does not change stock or create purchasing records.</p>
  </Workspace>
}
