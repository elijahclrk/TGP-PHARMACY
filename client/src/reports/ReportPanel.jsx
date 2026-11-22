import {useState} from 'react'
import {useAuth} from '../auth/auth-context'
import {useInventory} from '../inventory/useInventory'
import {fieldClass,secondaryClass,Paging} from '../inventory/shared'
import {php,manilaDates} from './format'
import SalesChart from './SalesChart'
import {downloadReport} from '../auth/api'
import HistoricalTransaction from './HistoricalTransaction'

const definitions={
  transactions:{label:'Transaction history',columns:[['receipt_no','Receipt'],['business_time','Time (Manila)'],['cashier','Cashier'],['item_count','Distinct products'],['sales_amount','Paid sales',php],['cash_tendered','Cash tendered',php],['change_due','Change',php],['return_requests','Return requests'],['benefit_type','Benefit'],['gross_amount','Snapshot gross',php],['discount_amount','Discount',php],['vat_removed_amount','VAT removed',php],['vat_amount','VAT charged',php]]},
  categories:{label:'Sales by category',columns:[['current_category','Current category'],['units','Units sold'],['transactions','Transactions'],['sales_amount','Paid sales',php]]},
  'best-selling':{label:'Best-selling by category',columns:[['current_category','Current category'],['category_rank','Rank in category'],['name','Product'],['units','Units sold'],['sales_amount','Paid sales',php]]},
  'slow-moving':{label:'Slow-moving products',columns:[['current_category','Current category'],['category_rank','Rank in category'],['name','Product'],['units','Units sold'],['sales_amount','Paid sales',php]]},
  returns:{label:'Return decisions (no cash reversal)',columns:[['return_id','Return'],['receipt_no','Receipt'],['quantity','Requested units'],['decision_state','Decision'],['received_quantity','Physically received units'],['recorded_time','Recorded date (Manila)']]},
  sales:{label:'Sales summary',columns:[['period_start','Period starting'],['transactions','Transactions'],['reviewed','Historical review recorded'],['unreviewed','No historical review'],['sales_amount','Paid sales',php]]},
  products:{label:'Sales by product',columns:[['name','Product'],['category','Current category'],['units','Units sold'],['transactions','Transactions'],['sales_amount','Paid sales',php]]},
  'low-stock':{label:'Low stock',columns:[['name','Product'],['qty_on_hand','Recorded stock'],['within_date_qty','Within-date (expiry only)'],['expired_or_today_qty','Expired / today'],['reorder_level','Reorder level']]},
  'near-expiry':{label:'Near expiry',columns:[['product_name','Product'],['batch_no','Batch'],['expiry_date','Expiry'],['qty_on_hand','On hand']]},
  valuation:{label:'Inventory valuation',columns:[['expiry_group','Expiry group'],['batches','Batches'],['unverified_batches','Unverified batches'],['cost_value','Recorded cost value',php]]},
  profit:{label:'Gross profit estimate',columns:[]},
}
export default function ReportPanel() {
  const [selected,setSelected]=useState(null)
  const {user}=useAuth();const admin=user.role==='admin';const {today,monday}=manilaDates()
  const [kind,setKind]=useState('sales')
  const [filters,setFilters]=useState({from:monday,to:today,period:'day',page:1,max_units:'0',category:'',receipt:''})
  const [exportState,setExportState]=useState({busy:false,error:''})
  const [revision,setRevision]=useState(0)
  const details=['transactions','categories','best-selling','slow-moving','returns']
  const dated=['sales','products','profit',...details].includes(kind)
  const paged=['products','low-stock','near-expiry'].includes(kind)
  const ranked=['best-selling','slow-moving'].includes(kind)
  const params={...(dated?{from:filters.from,to:filters.to}:{}),...(kind==='transactions'?{receipt:filters.receipt}:{}),...(kind==='sales'?{period:filters.period}:{}),...(kind==='slow-moving'?{max_units:filters.max_units}:{}),...(ranked?{category:filters.category}:{}),...(paged?{page:filters.page,limit:20}:{})}
  const result=useInventory(`/reports/${kind}?${new URLSearchParams(params)}`,revision)
  const data=result.data
  const options=admin?['sales','transactions','products','categories','best-selling','slow-moving','returns','low-stock','near-expiry','valuation','profit']:['sales','low-stock','near-expiry']
  async function exportFile(format){
    setExportState({busy:true,error:''})
    const exportParams={...params,format};delete exportParams.page;delete exportParams.limit
    try{await downloadReport(`/reports/${kind}/export?${new URLSearchParams(exportParams)}`,`tgp-${kind}.${format}`);setExportState({busy:false,error:''})}
    catch(error){setExportState({busy:false,error:error.message})}
  }
  return <section className="mt-7 space-y-5" aria-label="Reports">
    <form key={kind} className="report-filters flex flex-wrap items-end gap-4 rounded-sm border border-slate-200 bg-white p-5" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);setFilters(current=>({...current,...Object.fromEntries(form),page:1}));setRevision(value=>value+1)}}>
      <div><label htmlFor="report-kind" className="mb-2 block text-sm font-semibold">Report</label><select id="report-kind" className={`${fieldClass} max-w-md`} value={kind} onChange={event=>{setKind(event.target.value);setFilters(current=>({...current,page:1}))}}>{options.map(key=><option value={key} key={key}>{definitions[key].label}</option>)}</select></div>
      {dated&&<><label className="text-sm font-medium">From (Manila)<input name="from" type="date" required defaultValue={filters.from} className={`${fieldClass} mt-2`}/></label><label className="text-sm font-medium">Through (Manila)<input name="to" type="date" required defaultValue={filters.to} className={`${fieldClass} mt-2`}/></label></>}
      {kind==='sales'&&<label className="text-sm font-medium">Group by<select name="period" defaultValue={filters.period} className={`${fieldClass} mt-2`}><option value="day">Daily</option><option value="week">Weekly (Monday start)</option>{admin&&<option value="month">Monthly</option>}</select></label>}
      <button className={secondaryClass}>Apply / refresh</button>
      {kind==='transactions'&&<label>Receipt search<input className={fieldClass} name="receipt" maxLength={200} defaultValue={filters.receipt}/></label>}
      {ranked&&<label>Category (exact current label)<input name="category" maxLength={200} defaultValue={filters.category} placeholder="All categories" className={fieldClass}/></label>}
      {kind==='slow-moving'&&<label>Maximum units sold in range<input name="max_units" type="number" min="0" max="999999" step="1" defaultValue={filters.max_units} className={fieldClass}/></label>}
      {dated&&<p className="w-full text-xs text-slate-500">Inclusive date range, maximum 366 days. Weekly/monthly groups include only dates inside the selected range.</p>}
    </form>
    {admin&&<div className="flex flex-wrap gap-3"><button disabled={exportState.busy||result.loading||!!result.error} className={secondaryClass} onClick={()=>exportFile('xlsx')}>Export Excel (.xlsx)</button><button disabled={exportState.busy||result.loading||!!result.error} className={secondaryClass} onClick={()=>exportFile('pdf')}>Export PDF</button><p className="w-full text-xs">Exports include all filtered rows (maximum 10,000), exact PHP amounts and reconciliation coverage. Beneficiary identifiers are omitted.</p></div>}
    {exportState.error&&<p role="alert">{exportState.error}</p>}
    {kind==='slow-moving'&&<p>Products with at most {filters.max_units} reconciled units sold in the selected period, including zero sales. This is a quantity filter, not an inferred stock or accounting classification.</p>}
    {['categories','slow-moving'].includes(kind)&&<p>Categories reflect the current catalog, not historical sale-time categories.</p>}
    {ranked&&<p>Grouped by current category. Rank uses reconciled units sold: highest first for best-selling, lowest first for slow-moving. Ties share a rank. Zero-sale products appear only in slow-moving results; missing categories remain unclassified.</p>}
    {kind==='returns'&&<p>Return request quantities and decision states are separate from original cash payments. Legacy records without a decision state remain unclassified.</p>}
    {dated?<p className="text-sm text-slate-600">Fully paid, reconciled POS sales from {filters.from} through {filters.to}, including supported immutable benefit snapshots. Normal completed cash sales require no manual approval. Historical review metadata does not determine recognition.</p>:<p className="text-sm text-slate-600">Current inventory snapshot, not historical inventory. Upcoming expiry is after today through three calendar months from the Manila business date; expired and expiring-today batches cannot be sold.</p>}
    {dated&&<p className="text-sm text-slate-600">Pending, rejected and accepted returns do not reverse recorded cash sales. No automatic refund, credit or exchange adjustment is included.</p>}
    {result.loading?<p role="status" className="p-8">Loading report...</p>:result.error?<div><p role="alert" className="text-red-800">{result.error}</p><button className={`${secondaryClass} mt-3`} onClick={()=>setRevision(value=>value+1)}>Retry report</button></div>:data&&<>
      {data.excluded_records>0&&<p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">{data.excluded_records} sales records excluded because payment, item, POS audit or supported-sale checks did not reconcile. They are not counted as zero-value sales.</p>}
      {kind==='sales'&&<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Paid sales',php(data.sales_amount)],['Transactions',data.transactions],['Historical review recorded',data.reviewed],['No historical review',data.unreviewed]].map(([label,value])=><article key={label} className="surface"><h2 className="text-sm text-slate-600">{label}</h2><p className="mt-4 text-2xl font-bold">{value}</p></article>)}</div><p className="text-sm text-slate-600">{data.reviewed} with historical review · {data.unreviewed} without historical review</p><SalesChart title="Sales over time" rows={data.data}/></>}
      {kind==='valuation'&&<div className="rounded-sm bg-green-50 p-5"><p className="text-xl font-bold">Cost valuation: {php(data.cost_value)}</p><p className="mt-2 text-sm">{data.unverified_batches} batches have unknown quantities or unverified costs. Includes expired/on-expiry stock at recorded cost, without write-downs.</p></div>}
      {kind==='profit'?<div className="rounded-sm border border-slate-200 bg-white p-6"><h2 className="text-xl font-semibold">Gross profit estimate</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[['Paid sales',php(data.sales_amount)],['Verified batch cost',php(data.cost_amount)],['Gross profit',php(data.gross_profit)],['Gross margin',data.gross_margin_percent===null?'Unavailable':`${data.gross_margin_percent}%`]].map(([label,value])=><div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>)}</dl><p className="mt-5 text-sm text-slate-600">{data.unverified_lines} sale lines lack an approved cost basis, including discounted lines pending accounting review. Estimates exclude operating expenses and return adjustments; they are not net profit.</p>{data.lines===0&&<p className="mt-4">No qualifying sales in this range.</p>}</div>:<div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
        <h2 className="p-5 font-semibold">{kind==='sales'?'Sales by period':definitions[kind].label}</h2>
        {!data.data?.length?<p className="p-10 text-center text-slate-500">No matching report records.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{definitions[kind].columns.map(([key,label])=><th key={key} className="whitespace-nowrap p-4">{label}</th>)}</tr></thead><tbody>{data.data.map((row,index)=><tr key={index} className="border-t border-slate-100">{definitions[kind].columns.map(([key,,format])=><td key={key} className="p-4">{kind==='transactions'&&key==='receipt_no'?<button className="text-red-700 underline" onClick={()=>setSelected(row.sale_id)}>{row[key]}</button>:format?format(row[key]):row[key]??'Not set'}</td>)}</tr>)}</tbody></table></div>}
        {paged&&<Paging data={data} onPage={page=>setFilters(current=>({...current,page}))}/>}
      </div>}
    </>}
    {selected&&<HistoricalTransaction id={selected} onClose={()=>setSelected(null)}/>}
  </section>
}
