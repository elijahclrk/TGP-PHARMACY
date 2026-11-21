import {useState} from 'react'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import {useInventory} from '../inventory/useInventory'
import {requestJson} from '../auth/api'
import {Field,buttonClass,secondaryClass,fieldClass,Paging,QueryState} from '../inventory/shared'
import WorkflowGate from '../workflows/WorkflowGate'
import WorkflowDetails from '../workflows/WorkflowDetails'
import {useAuth} from '../auth/auth-context'
import BatchPicker from '../workflows/BatchPicker'

export default function ControlledWorkflows({kind}){return <Workspace><PageHeading title={kind==='returns'?'Customer returns':'Inventory adjustments'} description="Requests require independent management review. Inventory changes are recorded atomically."/><WorkflowGate><WorkflowPage key={kind} kind={kind}/></WorkflowGate></Workspace>}
function WorkflowPage({kind}){
  const {user}=useAuth(),storageKey=`tgp-workflow:${user.user_id}:${kind}`
  const [revision,setRevision]=useState(0),[status,setStatus]=useState('all'),[page,setPage]=useState(1),[selected,setSelected]=useState(null)
  const [receipt,setReceipt]=useState(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[attempt,setAttempt]=useState(()=>{try{return JSON.parse(sessionStorage.getItem(storageKey))}catch{return null}}),[notice,setNotice]=useState('')
  const [batchId,setBatchId]=useState(''),[selectedBatch,setSelectedBatch]=useState(null)
  const result=useInventory(`/workflows/${kind}?status=${status}&page=${page}&limit=20`,revision)
  const pk=kind==='returns'?'return_id':'adjustment_id',refresh=()=>setRevision(v=>v+1)
  async function lookup(e){e.preventDefault();setError('');setPending(true);try{const r=await requestJson(`/workflows/receipt?receipt=${encodeURIComponent(new FormData(e.currentTarget).get('receipt'))}`);setReceipt(r.data)}catch(err){setError(err.message);setReceipt(null)}finally{setPending(false)}}
  function remember(body){try{if(body)sessionStorage.setItem(storageKey,JSON.stringify(body));else sessionStorage.removeItem(storageKey);setAttempt(body);return true}catch{setError('Unable to retain the request reference safely. Check browser storage before submitting.');return false}}
  async function send(body){setPending(true);setError('');setNotice('');try{const r=await requestJson(`/workflows/${kind}`,{method:'POST',body:JSON.stringify(body)});setSelected(r.data[pk]);remember(null);setNotice('Request recorded. A different Manager/Admin must review it.');refresh()}catch(err){if([400,403,404].includes(err.status)){remember(null);setError(err.message)}else setError(`${err.message} The saved request is locked. Retry the same reference or check recorded requests before editing.`)}finally{setPending(false)}}
  function submit(e){e.preventDefault();if(attempt||pending)return;const d=new FormData(e.currentTarget),body={quantity:Number(d.get('quantity')),reason:d.get('reason'),request_key:crypto.randomUUID()};if(kind==='returns'){body.sale_id=receipt.sale_id;body.sale_item_id=Number(d.get('sale_item_id'))}else body.batch_id=Number(d.get('batch_id'));if(remember(body))send(body)}
  return <>
    <p className="mb-4 text-sm">Supplier deliveries use Stock-In. Pending return requests do not reserve sold units; acceptance rechecks cumulative approved quantities. Returns never automatically refund cash or add sellable stock.</p>
    {error&&<p role="alert" className="my-3 text-red-800">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {kind==='returns'&&<form onSubmit={lookup} className="my-4 flex items-end gap-3"><Field label="Original receipt number" id="return-receipt" name="receipt" required maxLength={100} disabled={pending||Boolean(attempt)}/><button disabled={pending||Boolean(attempt)} className={secondaryClass}>Find original receipt</button></form>}
    {(kind==='adjustments'||receipt)&&<form onSubmit={submit} aria-label="Create workflow request" className="my-5 space-y-3 rounded-lg border bg-white p-5">
      {kind==='adjustments'?<><BatchPicker disabled={pending||Boolean(attempt)} onSelect={batch=>{setBatchId(String(batch.batch_id));setSelectedBatch(batch)}}/>
        {selectedBatch&&<p>Selected: {selectedBatch.product_name} · {selectedBatch.batch_no} · expiry {selectedBatch.expiry_date}. Recorded balance is informational; approval rechecks current stock.</p>}
        <Field label="Original batch ID" id="adjustment-batch" name="batch_id" type="number" min={1} max={2147483647} required value={batchId} onChange={event=>{setBatchId(event.target.value);setSelectedBatch(null)}} disabled={pending||Boolean(attempt)}/>
        <p className="text-sm">Choose the original batch above or enter its verified ID. Use a positive quantity to add or a negative quantity to deduct; zero is invalid. Employees submit requests only. A different Manager/Admin must approve before any stock changes.</p>
      </>:<><p>Receipt {receipt.receipt_no} — no automatic cash settlement.</p><label>Original sold item<select className={fieldClass} name="sale_item_id" required disabled={pending||Boolean(attempt)}>{receipt.items.map(i=><option key={i.sale_item_id} value={i.sale_item_id} disabled={Number(i.approved_returned)>=i.quantity}>{i.product_name} — batch {i.batch_no}; sold {i.quantity}, accepted {i.approved_returned}, pending {i.pending_requested}</option>)}</select></label></>}
      <Field label={kind==='adjustments'?'Quantity change (negative to deduct)':'Return quantity'} id="workflow-quantity" name="quantity" type="number" min={kind==='returns'?1:-2147483647} max={2147483647} step={1} required disabled={pending||Boolean(attempt)}/>
      <Field label="Reason" id="workflow-reason" name="reason" required maxLength={1000} disabled={pending||Boolean(attempt)}/>
      <button disabled={pending||Boolean(attempt)} className={buttonClass}>Submit {kind==='returns'?'return':'adjustment'} request</button>
    </form>}
    {attempt&&<section className="my-3 border p-4" aria-label="Saved workflow request"><p>Reference: {attempt.request_key}. Input remains locked until the stored outcome is checked.</p><button disabled={pending} className={secondaryClass} onClick={()=>send(attempt)}>Retry saved request</button><button disabled={pending} className={secondaryClass} onClick={async()=>{setPending(true);try{const r=await requestJson(`/workflows/${kind}?request_key=${attempt.request_key}`);if(r.data.length){setSelected(r.data[0][pk]);remember(null);refresh()}else setError('No request is recorded yet. Retry this saved reference; do not submit a replacement while its outcome is uncertain.')}catch(e){setError(e.message)}finally{setPending(false)}}}>Check saved request</button></section>}
    <div className="my-4 flex gap-3"><label>Request status<select className={fieldClass} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);setSelected(null)}}>{['all','pending','approved','rejected'].map(s=><option key={s} value={s}>{s}</option>)}</select></label><button className={secondaryClass} onClick={refresh}>Refresh recorded requests</button></div>
    <section className="table-frame"><QueryState result={result} retry={refresh} empty="No workflow requests"/>{!result.loading&&!result.error&&result.data?.data.length>0&&<table><thead><tr><th>Reference</th><th>Quantity</th><th>Reason</th><th>State</th><th>Details</th></tr></thead><tbody>{result.data.data.map(r=><tr key={r[pk]}><td>#{r[pk]}</td><td>{r.quantity}</td><td>{r.reason}</td><td>{r.decision_state}</td><td><button className={secondaryClass} onClick={()=>setSelected(r[pk])}>View request {r[pk]}</button></td></tr>)}</tbody></table>}{result.data&&!result.error&&<Paging data={result.data} onPage={setPage}/>}</section>
    {selected&&<WorkflowDetails key={`${kind}:${selected}`} kind={kind} id={selected} revision={revision} onChanged={refresh}/>} 
  </>
}
