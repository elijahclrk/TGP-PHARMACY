import {useState} from 'react'
import {requestJson} from '../auth/api'
import {useInventory} from '../inventory/useInventory'
import {Field,buttonClass,secondaryClass} from '../inventory/shared'
import LinkedReceiving from './LinkedReceiving'
export default function OrderOperations({id,revision,onChanged}){
 const result=useInventory(`/operations/purchase-orders/${id}`,revision),d=result.data?.data
 const [editing,setEditing]=useState(false),[receiving,setReceiving]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 async function save(e){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{await requestJson(`/operations/purchase-orders/${id}`,{method:'PATCH',body:JSON.stringify({expected_delivery:f.get('expected_delivery')||null,notes:f.get('notes')||null})});setEditing(false);onChanged();setNotice('Order details saved.')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="surface mt-5" aria-label="Order receiving progress">{result.error&&<p role="alert">{result.error}</p>}{d&&<><h3 className="font-semibold">Order receiving progress</h3><p>Status: {d.status.replaceAll('_',' ')}</p><p>Expected delivery: {d.expected_delivery||'Not set'}</p><p>Notes: {d.notes||'Not set'}</p><ul>{d.items.map(i=><li key={i.po_item_id}>{i.product_name}: {i.received} received / {i.quantity} ordered; {i.remaining} remaining</li>)}</ul>
  <button className={secondaryClass} onClick={()=>setEditing(v=>!v)}>Edit order details</button> {d.approved_by&&d.items.some(i=>i.remaining>0)&&<button className={buttonClass} onClick={()=>setReceiving(true)}>Receive this purchase order</button>}
  {editing&&<form className="mt-4 space-y-4" onSubmit={save}><fieldset disabled={busy}><Field label="Expected delivery" name="expected_delivery" id="expected-delivery" type="date" defaultValue={d.expected_delivery||''}/><Field label="Order notes" name="notes" id="order-notes" maxLength={1000} defaultValue={d.notes||''}/><button className={buttonClass}>Save order details</button></fieldset></form>}
 </>}{receiving&&<LinkedReceiving id={id} onCancel={()=>setReceiving(false)} onSaved={r=>{setReceiving(false);setNotice(`Linked stock-in #${r.stock_in_id} saved pending approval. Inventory unchanged.`);onChanged()}}/>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</section>
}
