import { useState } from 'react'
import { requestJson } from '../auth/api'
import { Field, buttonClass, secondaryClass } from './shared'

export default function BatchForm({ batch, productId, onSaved, onCancel }) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(['batch_no', 'expiry_date', 'cost_price', 'selling_price'].map(key => [key, form.get(key)]))
    setPending(true); setError('')
    try { await requestJson(batch ? `/inventory/batches/${batch.batch_id}` : `/products/${productId}/batches`, { method: batch ? 'PATCH' : 'POST', body: JSON.stringify(body) }); onSaved() }
    catch (failure) { setError(failure.status === 409 ? 'Recorded cost or receiving batch identity cannot be changed after use.' : failure.status ? failure.message : 'Unable to save. Please try again.') }
    finally { setPending(false) }
  }
  return <section aria-label="Batch editor" className="mb-7 rounded-xl border border-green-200 bg-white p-6">
    <h2 className="text-xl font-semibold">{batch ? 'Edit batch metadata' : 'Add zero-stock batch'}</h2>
    <p className="mt-2 text-sm text-slate-600">Quantity is {batch ? 'read-only' : 'fixed at zero'}. Stock-in and stock adjustments are not available in this phase.</p>
    <form onSubmit={submit} className="mt-5">
      {error && <p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Batch number" id="batch-number" name="batch_no" required maxLength={200} defaultValue={batch?.batch_no ?? ''} />
        <Field label="Expiry date" id="batch-expiry" name="expiry_date" type="date" min="0001-01-01" max="9999-12-31" required defaultValue={batch?.expiry_date ?? ''} />
        <Field label="Cost price" id="batch-cost" name="cost_price" required inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" maxLength={40} defaultValue={batch?.cost_price ?? ''} />
        <Field label="Selling price" id="batch-selling" name="selling_price" required inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" maxLength={40} defaultValue={batch?.selling_price ?? ''} />
      </div>
      <div className="mt-6 flex gap-3"><button disabled={pending} className={buttonClass}>{pending ? 'Saving…' : 'Save batch'}</button><button type="button" disabled={pending} onClick={onCancel} className={secondaryClass}>Cancel</button></div>
    </form>
  </section>
}
