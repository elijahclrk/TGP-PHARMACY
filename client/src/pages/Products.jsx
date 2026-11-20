import { displayValue } from '../inventory/format'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import Workspace from '../components/Workspace'
import { useInventory } from '../inventory/useInventory'
import ProductForm from '../inventory/ProductForm'
import { fieldClass, buttonClass, secondaryClass, StockBadge, Paging, QueryState } from '../inventory/shared'

export default function Products() {
  const { user } = useAuth()
  const canManage = ['admin', 'manager'].includes(user.role)
  const [query, setQuery] = useState({ q: '', category: '', stock: 'all', page: 1 })
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState(null)
  const [notice, setNotice] = useState('')
  const result = useInventory(`/products?${new URLSearchParams({ ...query, limit: 20 })}`, revision)
  function search(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setQuery({ q: data.get('q'), category: data.get('category'), stock: data.get('stock'), page: 1 })
  }
  const saved = () => { setEditor(null); setNotice('Product saved.'); setRevision(value => value + 1) }
  return <Workspace>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-green-700">Product catalog</p><h1 className="text-3xl font-bold tracking-tight">Products & stock availability</h1><p className="mt-3 text-slate-600">Search products and check recorded stock across their batches.</p></div>
      {canManage && <button onClick={() => { setEditor({}); setNotice('') }} className={buttonClass}>Add product</button>}
    </div>
    {notice && <p role="status" className="mb-5 rounded-lg bg-green-100 p-3 text-sm text-green-900">{notice}</p>}
    {editor && canManage && <ProductForm key={editor.product_id ?? 'new'} product={editor.product_id ? editor : null} admin={user.role === 'admin'} onSaved={saved} onCancel={() => setEditor(null)} />}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <form onSubmit={search} className="grid items-end gap-4 border-b border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div><label htmlFor="product-search" className="mb-2 block text-sm font-medium">Search</label><input id="product-search" name="q" placeholder="Product or generic name" maxLength={200} className={fieldClass} /></div>
        <div><label htmlFor="category-filter" className="mb-2 block text-sm font-medium">Category</label><input id="category-filter" name="category" placeholder="Exact category name" maxLength={200} className={fieldClass} /></div>
        <div><label htmlFor="stock-filter" className="mb-2 block text-sm font-medium">Stock</label><select id="stock-filter" name="stock" className={fieldClass}><option value="all">All products</option><option value="low">At or below reorder level</option></select></div>
        <button className={secondaryClass}>Search products</button>
      </form>
      <QueryState result={result} retry={() => setRevision(value => value + 1)} empty="No products found" />
      {!result.loading && !result.error && result.data?.data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Product', 'Category', 'Unit price', 'Recorded stock', 'Reorder level', 'Status', 'Actions'].map(label => <th key={label} className="whitespace-nowrap px-5 py-4 font-medium">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{result.data.data.map(product => <tr key={product.product_id} className="hover:bg-green-50/30">
          <td className="px-5 py-4"><span className="font-semibold">{product.name || 'Unnamed product'}</span><div className="mt-1 text-slate-500">{product.generic_name || 'Generic name not set'}</div></td>
          <td className="px-5 py-4 text-slate-600">{product.category || 'Not set'}</td><td className="px-5 py-4 tabular-nums">{displayValue(product.unit_price)}</td>
          <td className="px-5 py-4 tabular-nums">{displayValue(product.qty_on_hand)}<div className="text-xs text-slate-500">{product.batch_count} batches</div></td><td className="px-5 py-4">{displayValue(product.reorder_level)}</td><td className="px-5 py-4"><StockBadge product={product} /></td>
          <td className="px-5 py-4"><div className="flex gap-4 whitespace-nowrap"><Link className="font-semibold text-green-800 underline-offset-4 hover:underline" to={`/inventory?product_id=${product.product_id}`}>View batches</Link>{canManage && <button className="font-semibold text-green-800" aria-label={`Edit ${product.name}`} onClick={() => setEditor(product)}>Edit</button>}</div></td>
        </tr>)}</tbody></table></div>}
      {!result.loading && !result.error && result.data && <Paging data={result.data} onPage={page => setQuery(value => ({ ...value, page }))} />}
    </section>
    <p className="mt-5 text-sm leading-relaxed text-slate-500">Totals include all recorded batches, including expired stock. Unknown quantities are shown as unknown. Stock-in approval and sale eligibility are not determined here.</p>
  </Workspace>
}
