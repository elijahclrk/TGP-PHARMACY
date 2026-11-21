import {useState} from 'react'
import {useInventory} from '../inventory/useInventory'
import {fieldClass,secondaryClass,Paging,QueryState} from '../inventory/shared'

export default function BatchPicker({onSelect,disabled}){
  const [draft,setDraft]=useState(''),[query,setQuery]=useState({q:'',page:1}),[revision,setRevision]=useState(0)
  const result=useInventory(`/inventory/batches?${new URLSearchParams({...query,limit:10})}`,revision)
  return <section className="space-y-3" aria-label="Find original adjustment batch">
    <label>Find product or batch<input className={fieldClass} maxLength={200} value={draft} disabled={disabled} onChange={event=>setDraft(event.target.value)}/></label>
    <button type="button" className={secondaryClass} disabled={disabled} onClick={()=>{setQuery({q:draft,page:1});setRevision(value=>value+1)}}>Search adjustment batches</button>
    <QueryState result={result} retry={()=>setRevision(value=>value+1)} empty="No matching batches"/>
    {!result.loading&&!result.error&&result.data?.data?.length>0&&<ul className="space-y-2">{result.data.data.map(batch=><li key={batch.batch_id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span>{batch.product_name} · {batch.batch_no} · expiry {batch.expiry_date??'Unknown'} · {batch.qty_on_hand??'Unknown'} recorded units</span><button type="button" className={secondaryClass} disabled={disabled} onClick={()=>onSelect(batch)}>Use batch {batch.batch_no}</button></li>)}</ul>}
    {result.data&&!result.error&&<Paging data={result.data} onPage={page=>setQuery(current=>({...current,page}))}/>}
  </section>
}
