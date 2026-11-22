import {useState} from 'react'
import {requestJson} from '../auth/api'
import {useAuth} from '../auth/auth-context'
import {useInventory} from '../inventory/useInventory'
import {Field,buttonClass,secondaryClass} from '../inventory/shared'
import Modal from '../components/Modal'

export default function LinkedReceiving({id,onSaved,onCancel}){
 const {user}=useAuth(),result=useInventory(`/operations/purchase-orders/${id}`,0),order=result.data?.data
 const storageKey=`tgp.linked-receiving.${user.user_id}.${id}`
 const [attempt,setAttempt]=useState(()=>{try{return sessionStorage.getItem(storageKey)||''}catch{return 'storage-unavailable'}})
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [lines,setLines]=useState([{key:1}]),[sequence,setSequence]=useState(2)
 function clear(){sessionStorage.removeItem(storageKey);setAttempt('')}
 async function resolve(){setBusy(true);setError('');try{if(attempt==='storage-unavailable')throw Error('Session storage is required for safe delivery recovery.');const r=await requestJson(`/operations/receiving-attempts/${attempt}/resolve`,{method:'POST',body:'{}'});clear();if(r.data.status==='recorded')onSaved(r.data.record);else setNotice('Previous attempt was closed without a delivery. Review all fields before submitting again.')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function submit(e){e.preventDefault();if(attempt)return;const f=new FormData(e.currentTarget),key=crypto.randomUUID(),body={po_id:id,request_id:key,delivery_ref:f.get('delivery_ref'),items:lines.map(l=>({po_item_id:Number(f.get(`po_item_id-${l.key}`)),quantity:Number(f.get(`quantity-${l.key}`)),...Object.fromEntries(['batch_no','expiry_date','cost_price','selling_price'].map(n=>[n,f.get(`${n}-${l.key}`)]))}))};setError('');setBusy(true)
  try{sessionStorage.setItem(storageKey,key);if(sessionStorage.getItem(storageKey)!==key)throw Error('Delivery recovery could not be stored.');setAttempt(key);const r=await requestJson('/operations/stock-ins',{method:'POST',body:JSON.stringify(body)});clear();onSaved(r.data)}catch(e){setError(`${e.message} Resolve the previous attempt before creating another delivery.`)}finally{setBusy(false)}
 }
 return <Modal title={`Receive purchase order #${id}`} onClose={onCancel} busy={busy} wide><section aria-label="Linked receiving editor">
  {result.loading&&<p>Loading order...</p>}{result.error&&<p role="alert">{result.error}</p>}
  <p>Enter quantities in individual inventory units. No box conversion is configured. Approval posts stock once; expired or expiring-today batches remain excluded from POS. Use a unique delivery reference for each delivery on this order.</p>
  {attempt&&<div role="status" className="my-4"><p>An earlier delivery attempt needs resolution before another submission.</p><button disabled={busy} className={secondaryClass} onClick={resolve}>Resolve delivery attempt</button></div>}
  {order&&<form onSubmit={submit} className="space-y-4 mt-4"><fieldset disabled={busy||!!attempt} className="space-y-4"><p>Supplier: {order.supplier_name}</p><Field label="Linked delivery reference" id="linked-delivery-ref" name="delivery_ref" required maxLength={200}/>
   {lines.map((line,index)=><div key={line.key} className="grid gap-3 border p-3 sm:grid-cols-3"><label>Ordered product {index+1}<select className="block w-full border p-2" name={`po_item_id-${line.key}`} required defaultValue=""><option value="">Choose ordered item</option>{order.items.filter(i=>i.remaining>0).map(i=><option value={i.po_item_id} key={i.po_item_id}>{i.product_name} / {i.remaining} remaining</option>)}</select></label>
    <Field label={`Linked quantity ${index+1}`} id={`linked-qty-${line.key}`} name={`quantity-${line.key}`} type="number" min="1" step="1" max="2147483647" required/>
    <Field label={`Linked batch ${index+1}`} id={`linked-batch-${line.key}`} name={`batch_no-${line.key}`} maxLength={200} required/>
    <Field label={`Linked expiry ${index+1}`} id={`linked-expiry-${line.key}`} name={`expiry_date-${line.key}`} type="date" min="0001-01-01" max="9999-12-31" required/>
    {['cost_price','selling_price'].map(n=><Field key={n} label={`${n==='cost_price'?'Linked cost':'Linked selling price'} ${index+1}`} id={`linked-${n}-${line.key}`} name={`${n}-${line.key}`} inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" maxLength={40} required/>)}
    {lines.length>1&&<button type="button" className={secondaryClass} onClick={()=>setLines(old=>old.filter(l=>l.key!==line.key))}>Remove delivery line {index+1}</button>}
   </div>)}
   <button type="button" disabled={lines.length>=100} className={secondaryClass} onClick={()=>{setLines(old=>[...old,{key:sequence}]);setSequence(n=>n+1)}}>Add delivery line</button> <button className={buttonClass}>Save linked pending delivery</button>
  </fieldset></form>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section></Modal>
}
