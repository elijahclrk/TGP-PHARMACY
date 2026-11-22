import { useState } from 'react'
import { requestJson } from '../auth/api'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import Icon from '../components/Icon'
import { useInventory } from '../inventory/useInventory'
import { buttonClass, secondaryClass, fieldClass, Paging, QueryState } from '../inventory/shared'
import PurchasingForm from '../purchasing/PurchasingForm'
import ReceivingSummary from '../purchasing/ReceivingSummary'
import { formatPHP } from '../utils/money'
import {useOperations} from '../inventory/useOperations'
import OrderOperations from '../purchasing/OrderOperations'

const settings = {
  suppliers: { path: '/suppliers', title: 'Suppliers', key: 'supplier_id', action: 'Add supplier' },
  orders: { path: '/purchase-orders', title: 'Purchase orders', key: 'po_id', action: 'Create purchase order' },
  receiving: { path: '/stock-ins', title: 'Stock-in', key: 'stock_in_id', action: 'Record delivery' },
}
const date = value => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not recorded'
export function PurchasingDetails({ kind, path, id, revision, onApproved, onEdit }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const retryResult = useInventory(`${path}/${id}`, `${revision}:${retry}`)
  const data = retryResult.data?.data
  async function approve() {
    setBusy(true); setError('')
    try { await requestJson(`${path}/${id}/approve`, { method: 'POST', body: '{}' }); onApproved() }
    catch (failure) { setError(failure.status === 409 ? 'This record is already approved or cannot be posted. Refresh and review its history.' : failure.status ? failure.message : 'Approval could not be confirmed. Refresh before retrying.'); setRetry(value => value + 1) }
    finally { setBusy(false) }
  }
  if (retryResult.loading) return <p role="status">Loading record...</p>
  if (retryResult.error) return <div><p role="alert">{retryResult.error}</p><button className={secondaryClass} onClick={() => setRetry(value => value + 1)}>Retry record</button></div>
  if (!data) return null
  return <section className="mt-6 rounded-sm border border-slate-200 bg-white p-6" aria-label="Record details">
    <h2 className="text-xl font-semibold">{kind === 'suppliers' ? data.name : `${kind === 'orders' ? 'Purchase order' : 'Stock-in'} #${id}`}</h2>
    {kind === 'suppliers' ? <><p className="mt-3">Contact: {data.contact_no || 'Not set'}</p><p>Address: {data.address || 'Not set'}</p><p>Contact person: {data.contact_person||'Not set'}</p><p>Email: {data.email||'Not set'}</p><p>Supplier status: {data.status||'Not set'}</p><button className={`${secondaryClass} mt-4`} onClick={() => onEdit(data)}>Edit supplier</button></> : <>
      <dl className="my-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Supplier</dt><dd>{data.supplier_name}</dd></div>
        <div><dt className="text-slate-500">Status</dt><dd>{data.status?data.status.replaceAll('_',' '):data.approved_by ? 'Approved' : 'Pending approval'}</dd></div>
        <div><dt className="text-slate-500">{kind === 'orders' ? 'Created by' : 'Received by'}</dt><dd>User #{data.created_by || data.received_by} / {date(data.order_date || data.date_received)}</dd></div>
        <div><dt className="text-slate-500">Approved by</dt><dd>{data.approved_by ? `User #${data.approved_by}` : 'Awaiting approval'}</dd></div>
        {kind === 'receiving' && <div><dt className="text-slate-500">Delivery reference</dt><dd>{data.delivery_ref}</dd></div>}
        {kind==='receiving'&&data.po_id&&<div><dt>Purchase order</dt><dd>#{data.po_id}</dd></div>}
      </dl>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Product', 'Quantity', 'Unit cost', ...(kind === 'receiving' ? ['Batch / expiry', 'Current stock'] : [])].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{data.items.map(item => <tr className="border-t border-slate-100" key={item.item_id || item.po_item_id}><td className="p-3">{item.product_name}</td><td className="p-3">{item.quantity}</td><td className="p-3 whitespace-nowrap tabular-nums">{formatPHP(item.unit_cost)}</td>{kind === 'receiving' && <><td className="p-3">{item.batch_no} / {item.expiry_date}</td><td className="p-3">{item.qty_on_hand ?? 'Unknown'}</td></>}</tr>)}</tbody>
      </table></div>
      {kind === 'receiving' && <ReceivingSummary lines={data.items} />}
      {!data.approved_by && <div className="mt-5"><p className="mb-3 text-sm text-slate-600">{kind === 'receiving' ? 'Approval will add these quantities to inventory once.' : 'Approval does not post stock or mark this order received.'}</p><button disabled={busy} onClick={approve} className={buttonClass}>{busy ? 'Approving...' : kind === 'receiving' ? 'Approve and post stock' : 'Approve purchase order'}</button></div>}
      {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
      <h3 className="mt-6 font-semibold">Activity history</h3><ul className="mt-2 space-y-2 text-sm text-slate-600">{data.history.map((entry, index) => <li key={index}>{entry.action.includes('.approved:') ? 'Approved' : entry.action.includes('.metadata_updated:')?'Details updated':'Created'} by {entry.username} (#{entry.user_id}) — {date(entry.logged_at)}</li>)}</ul>
    </>}
  </section>
}
export default function Purchasing({ kind }) {
  const capabilities=useOperations()
  const config = settings[kind]
  const [query, setQuery] = useState({ q: '', page: 1 })
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState(null)
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  const result = useInventory(`${config.path}?${new URLSearchParams({ ...query, limit: 20 })}`, revision)
  const refresh = () => setRevision(value => value + 1)
  return <Workspace>
    <PageHeading title={config.title} action={<button type="button" className={buttonClass} onClick={() => { setEditor({}); setNotice('') }}><Icon name="plus"/>{config.action}</button>} />
    {kind==='receiving'&&<p className="mb-5 text-sm">Stock-In records physical deliveries. Expired and expiring-today quantities remain recorded stock and are excluded from POS eligibility; they are not sellable inventory. This does not create quarantine records or authorize use of unsuitable medicines. Follow the pharmacist's receiving/disposition procedure.</p>}
    {notice && <p role="status" className="mb-4 rounded-lg bg-green-100 p-4 text-green-900">{notice}</p>}
    {editor && <PurchasingForm key={editor.supplier_id || 'new'} kind={kind} path={config.path} record={editor.supplier_id ? editor : null} onCancel={() => setEditor(null)} onSaved={record => { setEditor(null); setSelected(record[config.key]); setNotice(kind === 'suppliers' ? 'Supplier saved.' : 'Pending record saved. Inventory unchanged.'); refresh() }} />}
    <section className="overflow-hidden rounded-sm border border-slate-200 bg-white">
      <form className="flex flex-wrap gap-3 p-5" onSubmit={event => { event.preventDefault(); setQuery({ q: new FormData(event.currentTarget).get('q'), page: 1 }) }}>
        <input aria-label={`Search ${config.title.toLowerCase()}`} name="q" className={`${fieldClass} min-w-40 flex-1`} maxLength={200} placeholder={kind === 'receiving' ? 'Supplier or delivery reference' : 'Supplier name'} /><button className={secondaryClass}>Search</button>
      </form>
      <QueryState result={result} retry={refresh} empty="No records found" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{(kind==='suppliers'?['Supplier','Contact number','Address','Action']:['Reference','Supplier',kind==='orders'?'Created (Manila)':'Received (Manila)','Status','Action']).map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.data.map(record=><tr key={record[config.key]}>{kind==='suppliers'?<><td className="font-semibold">{record.name}</td><td>{record.contact_no||'Not set'}</td><td>{record.address||'Not set'}</td></>:<><td>#{record[config.key]} {record.delivery_ref}</td><td>{record.supplier_name}</td><td>{date(record.order_date||record.date_received)}</td><td><span className={`rounded px-2 py-1 text-xs font-semibold ${record.approved_by?'bg-green-50 text-green-800':'bg-amber-50 text-amber-800'}`}>{record.status?record.status.replaceAll('_',' '):record.approved_by?'Approved':'Pending approval'}</span></td></>}<td><button aria-label={`View record ${record[config.key]}`} className="font-semibold text-red-700" onClick={()=>{setSelected(record[config.key]);setNotice('')}}>View</button></td></tr>)}</tbody></table></div>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(current => ({ ...current, page }))} />}
    </section>
    {!selected && kind!=='suppliers' && <div className="surface mt-6 text-sm text-slate-500">Select a record to view its items, approval status and activity history.</div>}
    {selected && <PurchasingDetails key={selected} kind={kind} path={config.path} id={selected} revision={revision} onEdit={setEditor} onApproved={() => { setNotice(kind === 'receiving' ? 'Approved. Stock posted successfully.' : 'Purchase order approved.'); refresh() }} />}
    {selected&&kind==='orders'&&capabilities.purchasing&&<OrderOperations key={selected} id={selected} revision={revision} onChanged={refresh}/>}
  </Workspace>
}
