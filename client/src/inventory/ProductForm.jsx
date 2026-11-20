import { useState } from 'react'
import { requestJson } from '../auth/api'
import { Field, buttonClass, secondaryClass } from './shared'
import Modal from '../components/Modal'

export default function ProductForm({ product, admin, onSaved, onCancel }) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(['name', 'generic_name', 'category', 'unit_price'].map(key => [key, form.get(key)]))
    if (admin) body.reorder_level = form.get('reorder_level') === '' ? null : Number(form.get('reorder_level'))
    setPending(true); setError('')
    try { await requestJson(product ? `/products/${product.product_id}` : '/products', { method: product ? 'PATCH' : 'POST', body: JSON.stringify(body) }); onSaved() }
    catch (failure) { setError(failure.status ? failure.message : 'Unable to save. Please try again.') }
    finally { setPending(false) }
  }
  return <Modal title={product ? 'Edit product' : 'Add product'} onClose={onCancel} busy={pending}><section aria-label="Product editor">
    <form onSubmit={submit} className="mt-5">
      {error && <p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Product name" id="product-name" name="name" required maxLength={200} defaultValue={product?.name ?? ''} />
        <Field label="Generic name" id="product-generic" name="generic_name" maxLength={200} defaultValue={product?.generic_name ?? ''} />
        <Field label="Category (confirmed name only)" id="product-category" name="category" maxLength={200} defaultValue={product?.category ?? ''} />
        <Field label="Unit price" id="product-price" name="unit_price" required inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" maxLength={40} defaultValue={product?.unit_price ?? ''} />
        {admin && <Field label="Reorder level" id="product-reorder" name="reorder_level" type="number" min="0" max="2147483647" step="1" defaultValue={product?.reorder_level ?? ''} />}
      </div>
      <p className="mt-4 text-sm text-slate-500">{admin ? 'Leave the reorder level blank if it has not been confirmed.' : 'Reorder thresholds are set by an administrator.'} Leave unconfirmed categories blank.</p>
      <div className="mt-6 flex gap-3"><button disabled={pending} className={buttonClass}>{pending ? 'Saving…' : 'Save product'}</button><button type="button" disabled={pending} onClick={onCancel} className={secondaryClass}>Cancel</button></div>
    </form>
  </section></Modal>
}
