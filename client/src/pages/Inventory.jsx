import { displayValue } from '../inventory/format'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import Workspace from '../components/Workspace'
import { useInventory } from '../inventory/useInventory'
import BatchForm from '../inventory/BatchForm'
import { fieldClass, buttonClass, secondaryClass, ExpiryBadge, Paging, QueryState } from '../inventory/shared'

export default function Inventory() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const productId = params.get('product_id') || ''
  const canManage = ['admin', 'manager'].includes(user.role)
  const [query, setQuery] = useState({ q: '', status: 'all', days: 30, page: 1 })
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState(null)
  const [notice, setNotice] = useState('')
  const result = useInventory(`/inventory/batches?${new URLSearchParams({ ...query, limit: 20, ...(productId ? { product_id: productId } : {}) })}`, `${revision}:${user.role}`)
  const product = useInventory(productId ? `/products/${encodeURIComponent(productId)}` : '/products?limit=1', revision)
  function search(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setQuery({ q: data.get('q'), status: data.get('status'), days: Number(data.get('days')), page: 1 })
  }
  const saved = () => { setEditor(null); setNotice('Batch metadata saved. Quantity unchanged.'); setRevision(value => value + 1) }
  return <Workspace>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-green-700">Batch inventory</p><h1 className="text-3xl font-bold tracking-tight">{productId ? product.data?.data?.name || 'Product batches' : 'Inventory overview'}</h1><p className="mt-3 text-slate-600">Review batch quantities, expiry dates and selling prices.</p></div>
      {canManage && productId && product.data?.data?.product_id && <button onClick={() => setEditor({})} className={buttonClass}>Add zero-stock batch</button>}
    </div>
    {productId ? <Link to="/inventory" className="mb-5 inline-block text-sm font-semibold text-green-800">View all inventory</Link> : canManage && <p className="mb-5 text-sm text-slate-600">To add a batch, choose a product from the <Link to="/products" className="font-semibold text-green-800 underline">product catalog</Link>.</p>}
    {productId && product.error && <p role="alert" className="mb-5 text-red-800">{product.error}</p>}
    {notice && <p role="status" className="mb-5 rounded-lg bg-green-100 p-3 text-sm text-green-900">{notice}</p>}
    {editor && canManage && <BatchForm key={editor.batch_id ?? productId} batch={editor.batch_id ? editor : null} productId={productId} onSaved={saved} onCancel={() => setEditor(null)} />}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <form onSubmit={search} className="grid items-end gap-4 border-b border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div><label htmlFor="batch-search" className="mb-2 block text-sm font-medium">Search</label><input id="batch-search" name="q" placeholder="Product, generic name or batch number" maxLength={200} className={fieldClass} /></div>
        <div><label htmlFor="expiry-filter" className="mb-2 block text-sm font-medium">Expiry filter</label><select id="expiry-filter" name="status" className={fieldClass}><option value="all">All batches</option><option value="near_expiry">Near expiry with stock</option><option value="expired">Expired with stock</option></select></div>
        <div><label htmlFor="expiry-days" className="mb-2 block text-sm font-medium">Window (days)</label><input id="expiry-days" name="days" type="number" min="0" max="365" step="1" required defaultValue="30" className={fieldClass} /></div>
        <button className={secondaryClass}>Search batches</button>
      </form>
      <QueryState result={result} retry={() => setRevision(value => value + 1)} empty="No batches found" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Product / batch', 'Expiry date', 'On hand', ...(canManage ? ['Cost price'] : []), 'Selling price', 'Expiry status', ...(canManage ? ['Actions'] : [])].map(label => <th key={label} className="whitespace-nowrap px-5 py-4 font-medium">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{result.data.data.map(batch => <tr key={batch.batch_id} className="hover:bg-green-50/30">
          <td className="px-5 py-4"><span className="font-semibold">{batch.product_name || 'Unnamed product'}</span><div className="mt-1 text-slate-500">{batch.batch_no || 'Batch number not set'}</div></td>
          <td className="px-5 py-4 whitespace-nowrap">{displayValue(batch.expiry_date)}</td><td className="px-5 py-4 tabular-nums">{displayValue(batch.qty_on_hand)}</td>
          {canManage && <td className="px-5 py-4 tabular-nums">{displayValue(batch.cost_price)}</td>}<td className="px-5 py-4 tabular-nums">{displayValue(batch.selling_price)}</td>
          <td className="px-5 py-4"><ExpiryBadge batch={batch} days={query.days} /></td>{canManage && <td className="px-5 py-4"><button onClick={() => setEditor(batch)} aria-label={`Edit batch ${batch.batch_no}`} className="whitespace-nowrap font-semibold text-green-800">Edit metadata</button></td>}
        </tr>)}</tbody></table></div>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(value => ({ ...value, page }))} />}
    </section>
    <p className="mt-5 text-sm leading-relaxed text-slate-500">The window is a search setting, not an approved pharmacy alert threshold. Dates use Asia/Manila; near expiry includes today through the selected day. Quantities are read-only.</p>
  </Workspace>
}
