import {useState} from 'react'
import {useAuth} from '../auth/auth-context'
import {requestJson,downloadReport} from '../auth/api'
import {useInventory} from '../inventory/useInventory'
import {buttonClass,secondaryClass,fieldClass} from '../inventory/shared'
import Modal from '../components/Modal'
import {workflowTime} from './time'

export default function Exchanges({approvalsOnly=false}){
 const cap=useInventory('/exchanges/availability')
 if(!cap.data?.data?.available)return null
 return <ExchangeWorkspace approvalsOnly={approvalsOnly}/>
}
function ExchangeWorkspace({approvalsOnly}){
 const {user}=useAuth(),key='tgp-exchange-attempt:'+user.user_id
 const [revision,setRevision]=useState(0),[state,setState]=useState(approvalsOnly?'pending':'all'),[selected,setSelected]=useState(null)
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[sources,setSources]=useState([]),[claims,setClaims]=useState({}),[cart,setCart]=useState({}),[reason,setReason]=useState(''),[route,setRoute]=useState('voluntary'),[quote,setQuote]=useState(null),[search,setSearch]=useState('')
 const [attempt,setAttempt]=useState(()=>{try{return JSON.parse(sessionStorage.getItem(key))}catch{return null}})
 const history=useInventory('/exchanges?state='+state,revision),products=useInventory('/exchanges/products?q='+encodeURIComponent(search))
 const refresh=()=>setRevision(v=>v+1)
 function remember(value){try{if(value)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key);setAttempt(value)}catch{throw Error('Unable to preserve the operation reference. No new request was sent.')}}
 async function run(work){setBusy(true);setError('');try{await work()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const draft=()=>({claims:Object.entries(claims).filter(([,q])=>Number(q)>0).map(([id,q])=>({return_id:Number(id),quantity:Number(q)})),items:Object.entries(cart).map(([id,q])=>({product_id:Number(id),quantity:Number(q)})),reason,route})
 function changed(work){work();setQuote(null)}
 async function recover(){await run(async()=>{const r=await requestJson(attempt.operation==='create'?'/exchanges/resolve-request':`/exchanges/${attempt.exchange_id}/resolve`,{method:'POST',body:JSON.stringify({request_id:attempt.request_id})});if(r.data.receipt)setSelected(r.data.receipt.exchange_id);remember(null);setQuote(null);refresh()})}
 return <section className="my-6 rounded-xl border bg-white p-5" aria-label="Product exchanges">
  <h2 className="text-xl font-semibold">Product exchanges <span className="text-sm text-slate-500">— local test environment</span></h2>
  <p className="my-2 text-sm">Voluntary equal or higher-value replacements require a different Manager/Admin reviewer. Returned medicines stay quarantined. Lower-value, defective, statutory, prescription and discounted cases require authorized handling; this workflow does not limit applicable remedies.</p>
  {error&&<p role="alert" className="my-3 text-red-800">{error}</p>}
  {attempt&&<aside className="my-3 border p-3" aria-label="Uncertain exchange attempt"><p>Operation outcome must be checked before any new request. Reference {attempt.request_id}.</p><button className={secondaryClass} disabled={busy} onClick={recover}>Check exchange outcome</button></aside>}
  {!approvalsOnly&&<fieldset disabled={busy||Boolean(attempt)} className="space-y-4">
   <form className="flex gap-3" onSubmit={e=>{e.preventDefault();const value=new FormData(e.currentTarget).get('receipt');run(async()=>{const r=await requestJson('/exchanges/sources?receipt='+encodeURIComponent(value));setSources(r.data);setClaims({});setQuote(null)})}}><label>Exchange original receipt<input className={fieldClass} name="receipt" required maxLength={100}/></label><button className={secondaryClass}>Find exchange source</button></form>
   {sources.length>0&&<div className="table-frame"><table><thead><tr><th>Original product / batch</th><th>Return / physical status</th><th>Available claim units</th><th>Exchange quantity</th></tr></thead><tbody>{sources.map(r=>{const available=r.decision_state==='approved'&&r.received_quantity===r.accepted?r.accepted-Number(r.allocated):0;return <tr key={r.sale_item_id+':'+r.return_id}><td>{r.product_name} / {r.batch_no}</td><td>#{r.return_id??'none'} · {r.decision_state??'No return'} · received {r.received_quantity??0}</td><td>{available}</td><td><input aria-label={'Exchange quantity for return '+r.return_id} className={fieldClass} type="number" min="0" max={available} step="1" disabled={!available} value={claims[r.return_id]??''} onChange={e=>changed(()=>setClaims({...claims,[r.return_id]:e.target.value}))}/></td></tr>})}</tbody></table></div>}
   <div className="grid gap-4 lg:grid-cols-2"><div><label>Replacement search<input className={fieldClass} value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="max-h-64 overflow-auto">{products.data?.data?.data?.map(p=><div key={p.product_id} className="flex items-center justify-between border-b p-2"><span>{p.name} · PHP {p.unit_price} · available {p.available}</span><button type="button" className={secondaryClass} disabled={!Number(p.available)} onClick={()=>changed(()=>setCart({...cart,[p.product_id]:(Number(cart[p.product_id])||0)+1}))}>Add replacement {p.name}</button></div>)}</div></div>
    <div><h3 className="font-semibold">Replacement basket</h3>{Object.entries(cart).map(([id,q])=><div key={id} className="my-2 flex gap-3"><label>Replacement quantity for product {id}<input className={fieldClass} type="number" min="1" step="1" value={q} onChange={e=>changed(()=>setCart({...cart,[id]:e.target.value}))}/></label><button type="button" className={secondaryClass} onClick={()=>changed(()=>{const next={...cart};delete next[id];setCart(next)})}>Remove replacement {id}</button></div>)}
     <label>Exchange reason<input className={fieldClass} value={reason} maxLength={1000} onChange={e=>changed(()=>setReason(e.target.value))}/></label>
     <label>Remedy route<select className={fieldClass} value={route} onChange={e=>changed(()=>setRoute(e.target.value))}><option value="voluntary">Voluntary exchange</option><option value="defective">Defective product — authorized remedy review</option><option value="statutory">Statutory remedy — authorized handling</option></select></label>
    </div></div>
   <button type="button" className={secondaryClass} onClick={()=>run(async()=>{const r=await requestJson('/exchanges/quote',{method:'POST',body:JSON.stringify(draft())});setQuote(r.data)})}>Review replacement quote</button>
   {quote&&<><Breakdown financial={quote.financial}/><button type="button" className={buttonClass} onClick={()=>run(async()=>{const id=crypto.randomUUID();remember({operation:'create',exchange_id:id,request_id:id});try{const r=await requestJson('/exchanges',{method:'POST',body:JSON.stringify({request_id:id,draft:draft(),quote_token:quote.quote_token})});remember(null);setSelected(r.data.exchange_id);setQuote(null);setCart({});setClaims({});refresh()}catch(e){setQuote(null);throw e}})}>Submit reviewed exchange</button></>}
  </fieldset>}
  <label className="my-4 block">Exchange state<select className={fieldClass} value={state} onChange={e=>setState(e.target.value)}>{['all','pending','approved','rejected','cancelled','posted'].map(s=><option key={s}>{s}</option>)}</select></label>
  <button className={secondaryClass} onClick={refresh}>Refresh exchange history</button>
  {history.error&&<p role="alert">{history.error}</p>}
  <div className="table-frame"><table><thead><tr><th>Exchange / initiator</th><th>State</th><th>Return value</th><th>Replacement value</th><th>Additional cash</th><th>Details</th></tr></thead><tbody>{history.data?.data?.map(r=><tr key={r.exchange_id}><td>{r.exchange_id} · User #{r.initiated_by}</td><td>{r.state}</td><td>PHP {r.return_value}</td><td>PHP {r.replacement_value}</td><td>PHP {r.additional_cash}</td><td><button className={secondaryClass} onClick={()=>setSelected(r.exchange_id)}>View exchange {r.exchange_id}</button></td></tr>)}</tbody></table></div>
  <p className="text-sm">History shows up to 200 recent matching records. Owner date-filtered reporting and exports are separate from ordinary paid-sales reports.</p>
  {user.role==='admin'&&<ExchangeReports/>}
  {selected&&<ExchangeDetails id={selected} revision={revision} onClose={()=>setSelected(null)} refresh={refresh} blocked={Boolean(attempt)} onPost={async(body)=>{remember({operation:'post',exchange_id:selected,request_id:body.request_id});const r=await requestJson(`/exchanges/${selected}/post`,{method:'POST',body:JSON.stringify(body)});remember(null);refresh();return r.data.receipt}}/>}
 </section>
}
export function Breakdown({financial}){return <section aria-label="Exchange settlement breakdown" className="my-3 rounded-lg border bg-slate-50 p-4"><p>Historical return value applied: PHP {financial.return_value}</p><p>Replacement value: PHP {financial.replacement_value}</p><p className="text-lg font-semibold">Additional cash payable: PHP {financial.additional_cash}</p><p className="text-sm">These are distinct amounts. No refund, transferable credit or tax adjustment is implied.</p></section>}
function ExchangeDetails({id,revision,onClose,refresh,onPost,blocked}){
 const {user}=useAuth(),result=useInventory('/exchanges/'+id,revision),[quote,setQuote]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reason,setReason]=useState(''),[tender,setTender]=useState('0')
 async function act(path,body){setBusy(true);setError('');try{await requestJson('/exchanges/'+id+path,{method:'POST',body:JSON.stringify(body)});setQuote(null);refresh()}catch(e){setQuote(null);setError(e.message)}finally{setBusy(false)}}
 const row=result.data?.data,reviewer=row&&['manager','admin'].includes(user.role)&&row.initiated_by!==user.user_id&&row.state==='pending'
 return <Modal title="Exchange details" onClose={onClose} busy={busy} wide>
  {result.loading&&<p>Loading exchange…</p>}{result.error&&<p role="alert">{result.error}</p>}{error&&<p role="alert">{error}</p>}
  {row&&<><p>{id} · <strong>{row.state}</strong> · Initiated by User #{row.initiated_by}</p><p>{row.confirmation_label}</p><p>Original sale #{row.root_sale_id}. Policy {row.policy_version}. {row.reason}</p><Breakdown financial={row}/>
   {row.items.map(i=><p key={i.exchange_item_id}>{i.product_name} · batch {i.batch_no} · expiry {i.expiry_date.slice(0,10)} · {i.quantity} × PHP {i.unit_price} = PHP {i.payable}</p>)}
   <p>Returned stock is not automatically restored. Prescription, discounted, defective and lower-value scenarios need authorized handling.</p>
   {row.settlement&&<p>Cash due PHP {row.settlement.cash_due}; tender PHP {row.settlement.tender}; change PHP {row.settlement.change_due}.</p>}
   {row.state==='pending'&&['manager','admin'].includes(user.role)&&row.initiated_by===user.user_id&&<p>You cannot review your own exchange.</p>}
   {['pending','approved'].includes(row.state)&&<label>Decision / cancellation reason<input className={fieldClass} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
   {reviewer&&<div className="my-3 flex gap-3"><button disabled={busy||blocked} className={buttonClass} onClick={()=>act('/decision',{decision:'approved'})}>Approve exchange</button><button disabled={busy||blocked||!reason.trim()} className={secondaryClass} onClick={()=>act('/decision',{decision:'rejected',reason})}>Reject exchange</button></div>}
   {['pending','approved'].includes(row.state)&&<button disabled={busy||blocked||!reason.trim()} className={secondaryClass} onClick={()=>act('/cancel',{reason})}>Cancel exchange reservation</button>}
   {row.state==='approved'&&row.initiated_by===user.user_id&&!blocked&&<><button className={secondaryClass} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await requestJson('/exchanges/'+id+'/quote',{method:'POST',body:'{}'});setQuote(r.data)}catch(e){setError(e.message);setQuote(null)}finally{setBusy(false)}}}>Review approved exchange</button>
    {quote&&<><Breakdown financial={quote.financial}/><label>Additional cash tendered (PHP)<input className={fieldClass} inputMode="decimal" value={tender} onChange={e=>setTender(e.target.value)} disabled={quote.financial.additional_cash==='0.00'}/></label><button className={buttonClass} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onPost({request_id:crypto.randomUUID(),quote_token:quote.quote_token,tender});setQuote(null)}catch(e){setError(e.message+' Close details and check the saved outcome before creating another attempt.');setQuote(null)}finally{setBusy(false)}}}>Complete exchange</button></>}
   </>}
   <h3 className="mt-4 font-semibold">Exchange audit history</h3>{row.events.map((e,i)=><p key={i}>{e.event_kind} · User #{e.actor_id} · {workflowTime(e.occurred_at)}</p>)}
  </>}
 </Modal>
}
function ExchangeReports(){
 const [day]=useState(()=>new Date(Date.now()+28800000).toISOString().slice(0,10)),[from,setFrom]=useState(day),[to,setTo]=useState(day),[report,setReport]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const filters=()=>`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
 async function run(work){setBusy(true);setError('');try{await work()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="mt-5 border-t pt-4" aria-label="Owner exchange reporting"><h3 className="font-semibold">Owner exchange reporting</h3><label>Exchange report from<input className={fieldClass} type="date" value={from} onChange={e=>{setFrom(e.target.value);setReport(null)}}/></label><label>Exchange report to<input className={fieldClass} type="date" value={to} onChange={e=>{setTo(e.target.value);setReport(null)}}/></label><button className={secondaryClass} disabled={busy} onClick={()=>run(async()=>setReport(await requestJson('/exchanges/report?'+filters())))}>Load exchange report</button>{error&&<p role="alert">{error}</p>}{report&&<><Breakdown financial={report}/><p>Posted exchanges: {report.transactions}. Original cash-sale reports remain unchanged.</p>{['xlsx','pdf'].map(format=><button key={format} className={secondaryClass} disabled={busy} onClick={()=>run(()=>downloadReport('/exchanges/report?'+filters()+'&format='+format,'tgp-exchanges.'+format))}>Export exchange {format.toUpperCase()}</button>)}</>}</section>
}
