import {useState} from 'react'
import {useAuth} from '../auth/auth-context'
import {useInventory} from '../inventory/useInventory'
import {fieldClass,secondaryClass,Paging} from '../inventory/shared'
import {php,manilaDates} from './format'
import SalesChart from './SalesChart'

const definitions={
  sales:{label:'Sales summary',columns:[['period_start','Period starting'],['transactions','Transactions'],['reviewed','Reviewed'],['unreviewed','Unreviewed'],['sales_amount','Paid sales',php]]},
  products:{label:'Sales by product',columns:[['name','Product'],['category','Current category'],['units','Units sold'],['transactions','Transactions'],['sales_amount','Paid sales',php]]},
  'low-stock':{label:'Low stock',columns:[['name','Product'],['qty_on_hand','Recorded stock'],['reorder_level','Reorder level']]},
  'near-expiry':{label:'Near expiry',columns:[['product_name','Product'],['batch_no','Batch'],['expiry_date','Expiry'],['qty_on_hand','On hand']]},
  valuation:{label:'Inventory valuation',columns:[['expiry_group','Expiry group'],['batches','Batches'],['unverified_batches','Unverified batches'],['cost_value','Recorded cost value',php]]},
  profit:{label:'Gross profit estimate',columns:[]},
}
export default function ReportPanel() {
  const {user}=useAuth();const admin=user.role==='admin';const {today,monday}=manilaDates()
  const [kind,setKind]=useState('sales')
  const [filters,setFilters]=useState({from:monday,to:today,period:'day',days:30,page:1})
  const [revision,setRevision]=useState(0)
  const dated=['sales','products','profit'].includes(kind)
  const paged=['products','low-stock','near-expiry'].includes(kind)
  const params={...(dated?{from:filters.from,to:filters.to}:{}),...(kind==='sales'?{period:filters.period}:{}),...(kind==='near-expiry'?{days:filters.days}:{}),...(paged?{page:filters.page,limit:20}:{})}
  const result=useInventory(`/reports/${kind}?${new URLSearchParams(params)}`,revision)
  const data=result.data
  const options=admin?['sales','products','low-stock','near-expiry','valuation','profit']:['sales','low-stock','near-expiry']
  return <section className="mt-7 space-y-5" aria-label="Reports">
    <form key={kind} className="report-filters flex flex-wrap items-end gap-4 rounded-sm border border-slate-200 bg-white p-5" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);setFilters(current=>({...current,...Object.fromEntries(form),page:1}));setRevision(value=>value+1)}}>
      <div><label htmlFor="report-kind" className="mb-2 block text-sm font-semibold">Report</label><select id="report-kind" className={`${fieldClass} max-w-md`} value={kind} onChange={event=>{setKind(event.target.value);setFilters(current=>({...current,page:1}))}}>{options.map(key=><option value={key} key={key}>{definitions[key].label}</option>)}</select></div>
      {dated&&<><label className="text-sm font-medium">From (Manila)<input name="from" type="date" required defaultValue={filters.from} className={`${fieldClass} mt-2`}/></label><label className="text-sm font-medium">Through (Manila)<input name="to" type="date" required defaultValue={filters.to} className={`${fieldClass} mt-2`}/></label></>}
      {kind==='sales'&&<label className="text-sm font-medium">Group by<select name="period" defaultValue={filters.period} className={`${fieldClass} mt-2`}><option value="day">Daily</option><option value="week">Weekly (Monday start)</option>{admin&&<option value="month">Monthly</option>}</select></label>}
      {kind==='near-expiry'&&<label className="text-sm font-medium">Window (days)<input name="days" type="number" min="0" max="365" required defaultValue={filters.days} className={`${fieldClass} mt-2`}/></label>}
      <button className={secondaryClass}>Apply / refresh</button>
      {dated&&<p className="w-full text-xs text-slate-500">Inclusive date range, maximum 366 days. Weekly/monthly groups include only dates inside the selected range.</p>}
    </form>
    {dated?<p className="text-sm text-slate-600">Fully paid, reconciled regular POS sales from {filters.from} through {filters.to}. Unreviewed sales are included, separately labelled. This is not an approved-only owner report.</p>:<p className="text-sm text-slate-600">Current inventory snapshot, not historical inventory. Near-expiry includes today; POS excludes batches expiring today. The window is a search setting, not an approved alert policy.</p>}
    {result.loading?<p role="status" className="p-8">Loading report...</p>:result.error?<div><p role="alert" className="text-red-800">{result.error}</p><button className={`${secondaryClass} mt-3`} onClick={()=>setRevision(value=>value+1)}>Retry report</button></div>:data&&<>
      {data.excluded_records>0&&<p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">{data.excluded_records} sales records excluded because payment, item, POS audit or supported-sale checks did not reconcile. They are not counted as zero-value sales.</p>}
      {kind==='sales'&&<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Paid sales',php(data.sales_amount)],['Transactions',data.transactions],['Reviewed sales',data.reviewed],['Unreviewed sales',data.unreviewed]].map(([label,value])=><article key={label} className="surface"><h2 className="text-sm text-slate-600">{label}</h2><p className="mt-4 text-2xl font-bold">{value}</p></article>)}</div><p className="text-sm text-slate-600">{data.reviewed} reviewed · {data.unreviewed} unreviewed</p><SalesChart title="Sales over time" rows={data.data}/></>}
      {kind==='valuation'&&<div className="rounded-sm bg-green-50 p-5"><p className="text-xl font-bold">Cost valuation: {php(data.cost_value)}</p><p className="mt-2 text-sm">{data.unverified_batches} batches have unknown quantities or unverified costs. Includes expired/on-expiry stock at recorded cost, without write-downs.</p></div>}
      {kind==='profit'?<div className="rounded-sm border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">Gross profit estimate</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[['Paid sales',php(data.sales_amount)],['Verified batch cost',php(data.cost_amount)],['Gross profit',php(data.gross_profit)],['Gross margin',data.gross_margin_percent===null?'Unavailable':`${data.gross_margin_percent}%`]].map(([label,value])=><div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>)}</dl><p className="mt-5 text-sm text-slate-600">{data.unverified_lines} sale lines have unverified batch costs. Estimates exclude operating expenses, taxes and unimplemented discounts/returns; they are not net profit.</p>{data.lines===0&&<p className="mt-4">No qualifying sales in this range.</p>}</div>:<div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
        <h2 className="p-5 font-semibold">{kind==='sales'?'Sales by period':definitions[kind].label}</h2>
        {!data.data?.length?<p className="p-10 text-center text-slate-500">No matching report records.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{definitions[kind].columns.map(([key,label])=><th key={key} className="whitespace-nowrap p-4">{label}</th>)}</tr></thead><tbody>{data.data.map((row,index)=><tr key={index} className="border-t border-slate-100">{definitions[kind].columns.map(([key,,format])=><td key={key} className="p-4">{format?format(row[key]):row[key]??'Not set'}</td>)}</tr>)}</tbody></table></div>}
        {paged&&<Paging data={data} onPage={page=>setFilters(current=>({...current,page}))}/>}
      </div>}
    </>}
  </section>
}
