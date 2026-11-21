import {useState} from 'react'
import {useAuth} from '../auth/auth-context'
import {requestJson} from '../auth/api'
import {useInventory} from '../inventory/useInventory'
import {Field,buttonClass,secondaryClass,fieldClass} from '../inventory/shared'
import {useWorkflowCapabilities} from './useWorkflowCapabilities'
import {workflowTime} from './time'

export default function WorkflowDetails({kind,id,revision=0,onChanged}){
  const {user}=useAuth(),result=useInventory(`/workflows/${kind}/${id}`,revision),cap=useWorkflowCapabilities()
  const authorizations=useInventory(user.role==='employee'?'/workflows/capabilities':'/workflows/pharmacist-authorizations',revision)
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const storageKey=`tgp-disposition:${user.user_id}:${kind}:${id}`
  const [dispositionAttempt,setDispositionAttempt]=useState(()=>{try{return JSON.parse(sessionStorage.getItem(storageKey))}catch{return null}})
  if(result.loading)return <p role="status">Loading request…</p>
  if(result.error)return <p role="alert">{result.error}</p>
  const row=result.data.data,manage=['admin','manager'].includes(user.role),initiator=row.adjusted_by??row.processed_by??row.requested_by
  const reviewer=manage&&user.user_id!==initiator&&row.decision_state==='pending'
  const restock=kind==='dispositions'&&row.action==='restock'
  async function mutate(path,body,message){setPending(true);setError('');setNotice('');try{await requestJson(path,{method:'POST',body:JSON.stringify(body)});setNotice(message);onChanged()}catch(e){setError(`${e.message} Reload the request to verify its recorded state before retrying.`)}finally{setPending(false)}}
  function decision(event){event.preventDefault();const data=new FormData(event.currentTarget),decision=event.nativeEvent.submitter?.value;if(!decision)return
    const body={decision};if(decision==='rejected')body.reason=data.get('decision_reason')?.trim()
    if(decision==='rejected'&&!body.reason){setError('Enter a nonblank rejection reason.');return}
    if(restock&&decision==='approved'){body.authorization_id=Number(data.get('authorization_id'));body.assessment=data.get('assessment');body.restock_eligible=data.get('restock_eligible')==='on'}
    if(restock&&decision==='approved'&&(!body.authorization_id||!body.assessment?.trim()||!body.restock_eligible)){setError('Verify suitability and enter the pharmacist assessment and authorization.');return}
    mutate(`/workflows/${kind}/${id}/decision`,body,`Decision recorded: ${decision}.`)
  }
  function rememberDisposition(body){try{if(body)sessionStorage.setItem(storageKey,JSON.stringify(body));else sessionStorage.removeItem(storageKey);setDispositionAttempt(body);return true}catch{setError('Unable to retain the disposition reference safely. Check browser storage.');return false}}
  async function submitDisposition(body){setPending(true);setError('');try{await requestJson('/workflows/dispositions',{method:'POST',body:JSON.stringify(body)});rememberDisposition(null);setNotice('Disposition requested. A separate reviewer must decide.');onChanged()}catch(e){if([400,403,404].includes(e.status))rememberDisposition(null);setError(`${e.message} Check the stored disposition before creating another request.`)}finally{setPending(false)}}
  function requestDisposition(event){event.preventDefault();if(pending||dispositionAttempt)return;const data=new FormData(event.currentTarget),body={return_id:id,quantity:Number(data.get('quantity')),action:data.get('action'),reason:data.get('reason'),request_key:crypto.randomUUID()}
    if(rememberDisposition(body))submitDisposition(body)
  }
  const remaining=Number(row.quarantined_remaining??0)
  return <section aria-label="Workflow details" className="mt-6 rounded-lg border bg-white p-5">
    <h2 className="text-xl font-semibold">Request #{id}</h2><p>Status: <strong>{row.decision_state}</strong></p>
    <p>Initiated by User #{initiator}. Quantity: {row.quantity}. Reason: {row.reason}</p>
    {row.batch&&<p>{row.batch.product_name} — batch {row.batch.batch_no} (#{row.batch.batch_id})</p>}
    {row.original&&<p>Receipt {row.original.receipt_no}; {row.original.product_name}; sold batch {row.original.batch_no} (#{row.original.batch_id})</p>}
    {row.reviewed_by&&<p>Reviewed by User #{row.reviewed_by}. {row.decision_reason}</p>}
    {row.restock_assessment&&<p>Pharmacist assessment: {row.restock_assessment}</p>}
    {error&&<p role="alert" className="my-3 text-red-800">{error}</p>}{notice&&<p role="status" className="my-3 text-green-800">{notice}</p>}
    <button className={secondaryClass} disabled={pending} onClick={onChanged}>Reload recorded state</button>
    {reviewer&&<form onSubmit={decision} className="my-4 space-y-3" aria-label="Review request">
      <Field label="Rejection reason" id={`review-reason-${kind}-${id}`} name="decision_reason" maxLength={1000}/>
      {restock&&cap.restocking&&<><label>Current pharmacist authorization<select className={fieldClass} name="authorization_id" defaultValue=""><option value="">Select your verified authorization</option>{authorizations.data?.data?.map(a=><option key={a.authorization_id} value={a.authorization_id}>Authorization #{a.authorization_id}</option>)}</select></label>
        <Field label="Pharmacist suitability and storage assessment" id={`assessment-${id}`} name="assessment" maxLength={1000}/>
        <label className="block"><input name="restock_eligible" type="checkbox"/> I verified medicine integrity, storage history and suitability for sellable inventory.</label></>}
      <button type="submit" name="decision" value="approved" disabled={pending||(restock&&(!cap.restocking||!authorizations.data?.data?.length))} className={buttonClass}>Approve{kind==='adjustments'||restock?' and post stock':''}</button>{' '}
      <button type="submit" name="decision" value="rejected" disabled={pending} className={secondaryClass}>Reject request</button>
    </form>}
    {row.decision_state==='pending'&&manage&&!reviewer&&<p className="my-3">A different Manager/Admin must review your request.</p>}
    {kind==='returns'&&<><p className="my-3">Physically received: {row.received_quantity}. Quarantine remaining: {row.quarantined_remaining}. Acceptance does not refund cash or restore sellable stock.</p>
      {row.decision_state==='approved'&&row.received_quantity===0&&<button className={buttonClass} disabled={pending} onClick={()=>mutate(`/workflows/returns/${id}/receive`,{},'Full receipt recorded in quarantine.')}>Confirm full physical receipt into quarantine</button>}
      {manage&&remaining>0&&<form onSubmit={requestDisposition} aria-label="Request disposition" className="my-4 space-y-3"><h3 className="font-semibold">Request controlled disposition</h3>
        <label>Disposition action<select className={fieldClass} name="action" disabled={pending||Boolean(dispositionAttempt)}><option value="destroy">Destroy</option><option value="supplier_return">Return to supplier</option>{cap.restocking&&<option value="restock">Pharmacist review for restocking</option>}</select></label>
        <Field label="Disposition quantity" id={`disposition-quantity-${id}`} name="quantity" type="number" min={1} max={remaining} defaultValue={remaining} required disabled={pending||Boolean(dispositionAttempt)}/>
        <Field label="Disposition reason" id={`disposition-reason-${id}`} name="reason" required maxLength={1000} disabled={pending||Boolean(dispositionAttempt)}/>
        <button disabled={pending||Boolean(dispositionAttempt)} className={buttonClass}>Submit disposition request</button>
      </form>}
      {dispositionAttempt&&<div><p>Saved disposition reference: {dispositionAttempt.request_key}</p><button className={secondaryClass} disabled={pending} onClick={()=>submitDisposition(dispositionAttempt)}>Retry saved disposition</button><button className={secondaryClass} disabled={pending} onClick={async()=>{setPending(true);try{const r=await requestJson(`/workflows/dispositions?request_key=${dispositionAttempt.request_key}`);if(r.data.length){rememberDisposition(null);onChanged()}else setError('No disposition recorded yet. Retry the saved reference.')}catch(e){setError(e.message)}finally{setPending(false)}}}>Check saved disposition</button></div>}
      {row.dispositions?.map(d=><details className="my-3" key={d.disposition_id}><summary>{d.action} #{d.disposition_id} — {d.decision_state}, quantity {d.quantity}</summary>{manage?<WorkflowDetails kind="dispositions" id={d.disposition_id} revision={revision} onChanged={onChanged}/>:<p>Decision reviewer: {d.reviewed_by?`User #${d.reviewed_by}`:'Not yet reviewed'}</p>}</details>)}
    </>}
    <h3 className="mt-4 font-semibold">Recorded audit history (Asia/Manila)</h3>{row.history?.length?<ul>{row.history.map((h,i)=><li key={`${h.action}:${i}`}>{workflowTime(h.logged_at)} — {h.username}: {h.action}</li>)}</ul>:<p>No workflow events recorded.</p>}
    <p className="mt-4 text-sm text-slate-500">No automatic refund, credit or exchange. Supplier deliveries use Stock-In.</p>
  </section>
}
