import { useState } from 'react'
import { requestJson } from '../auth/api'
import { Field, buttonClass, secondaryClass } from '../inventory/shared'
import RecordPicker from './RecordPicker'
import ReceivingSummary from './ReceivingSummary'
import { receivingSummary } from './receiving-summary'
import { formatPHP } from '../utils/money'
import Modal from '../components/Modal'

export default function PurchasingForm({ kind, path, record, onSaved, onCancel }) {
  const [supplierId, setSupplierId] = useState(null)
  const [lines, setLines] = useState([{ key: 1, product_id: null }])
  const [nextKey, setNextKey] = useState(2)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const supplier = kind === 'suppliers'
  const receiving = kind === 'receiving'
  async function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    let body
    if (supplier) body = Object.fromEntries(['name', 'contact_no', 'address'].map(field => [field, values.get(field)]))
    else body = { supplier_id: supplierId, ...(receiving ? { delivery_ref: values.get('delivery_ref') } : {}), items: lines.map(line => ({
      product_id: line.product_id, quantity: Number(values.get(`quantity-${line.key}`)),
      ...Object.fromEntries((receiving ? ['batch_no', 'expiry_date', 'cost_price', 'selling_price'] : ['unit_cost']).map(field => [field, values.get(`${field}-${line.key}`)])),
    })) }
    setPending(true); setError('')
    try {
      const result = await requestJson(record ? `${path}/${record.supplier_id}` : path, { method: record ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      onSaved(result.data)
    } catch (failure) { setError(failure.status ? failure.message : 'Unable to save. Check the connection and review the list before retrying.') }
    finally { setPending(false) }
  }
  const previewField = (key, field, value) => setLines(current => current.map(line => line.key === key ? { ...line, [field]: value } : line))
  const money = (label, field, key) => <Field label={label} id={`${field}-${key}`} name={`${field}-${key}`} required inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" maxLength={40} onChange={event => previewField(key, field, event.target.value)} />
  const title = supplier ? record ? 'Edit supplier' : 'Add supplier' : receiving ? 'Record delivery' : 'Create purchase order'
  const content = <section className={receiving ? 'surface mb-6 receiving-editor' : ''} aria-label="Record editor">
    {receiving && <h2 className="text-xl font-semibold">Receiving details</h2>}
    {!supplier && <p className="mt-2 text-sm text-slate-600">{receiving ? 'This saves pending receiving and creates zero-stock batches. Inventory increases only after approval.' : 'Purchase orders are independent of receiving. Approval does not change inventory.'}</p>}
    <form onSubmit={submit} className="mt-5 space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        {supplier ? <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier name" id="supplier-name" name="name" required maxLength={200} defaultValue={record?.name || ''} />
          <Field label="Contact number" id="supplier-contact" name="contact_no" maxLength={500} defaultValue={record?.contact_no || ''} />
          <Field label="Address" id="supplier-address" name="address" maxLength={500} defaultValue={record?.address || ''} />
        </div> : <>
          <div className="grid items-start gap-6 sm:grid-cols-2">{receiving && <Field label="Delivery reference" id="delivery-ref" name="delivery_ref" required maxLength={200} />}
          <RecordPicker label="Supplier" path="/suppliers" idKey="supplier_id" onSelect={setSupplierId} /></div>
          <h3 className="text-lg font-semibold">{receiving ? 'Stock-in lines' : 'Purchase order lines'}</h3>
          <div className="table-frame"><table className="receiving-lines"><caption className="sr-only">{receiving ? 'Delivery items' : 'Purchase order items'}</caption><thead><tr>{['Product',...(receiving?['Batch number']:[]),'Quantity',...(receiving?['Expiry date']:[]),receiving?'Cost price':'Unit cost',...(receiving?['Selling price','Line cost (preview)']:[]),'Action'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>
          {lines.map((line, index) => <tr key={line.key}>
              <td><RecordPicker label={`Product ${index + 1}`} path="/products" idKey="product_id" onSelect={id => setLines(current => current.map(item => item.key === line.key ? { ...item, product_id: id } : item))} /></td>
              {receiving ? <>
                <td><Field label={`Batch number ${index + 1}`} id={`batch_no-${line.key}`} name={`batch_no-${line.key}`} required maxLength={200} /></td>
              </> : null}
              <td><Field label={`Quantity ${index + 1}`} id={`quantity-${line.key}`} name={`quantity-${line.key}`} type="number" min="1" max="2147483647" step="1" required onChange={event => previewField(line.key, 'quantity', event.target.value)} /></td>
              {receiving && <td><Field label={`Expiry date ${index + 1}`} id={`expiry_date-${line.key}`} name={`expiry_date-${line.key}`} type="date" min="0001-01-01" max="9999-12-31" required /></td>}
              <td>{receiving?money(`Cost price ${index + 1}`, 'cost_price', line.key):money(`Unit cost ${index + 1}`, 'unit_cost', line.key)}</td>
              {receiving&&<td>{money(`Selling price ${index + 1}`, 'selling_price', line.key)}</td>}
              {receiving&&<td className="whitespace-nowrap tabular-nums">{formatPHP(receivingSummary([line]).cost)}</td>}
              <td>{lines.length > 1 ? <button type="button" className={secondaryClass} onClick={() => setLines(current => current.filter(item => item.key !== line.key))}>Remove item {index + 1}</button> : <span className="text-xs text-slate-500">Required item</span>}</td>
          </tr>)}
          </tbody></table></div>
          <button type="button" disabled={lines.length >= 100} className={secondaryClass} onClick={() => { setLines(current => [...current, { key: nextKey, product_id: null }]); setNextKey(value => value + 1) }}>Add item</button>
          {receiving && <ReceivingSummary lines={lines} draft />}
        </>}
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-5"><button type="button" className={secondaryClass} onClick={onCancel}>Cancel</button><button className={buttonClass}>{pending ? 'Saving...' : supplier ? 'Save supplier' : 'Save pending record'}</button></div>
      </fieldset>
      {error && <p role="alert" className="text-red-800">{error}</p>}
    </form>
  </section>
  return receiving ? content : <Modal title={title} onClose={onCancel} busy={pending} wide={!supplier}>{content}</Modal>
}
