import {Link} from 'react-router-dom'
import {useState} from 'react'
import {useInventory} from '../inventory/useInventory'
import {secondaryClass} from '../inventory/shared'
import {php,manilaDates} from './format'

function SummaryCard({title,path,money=false}) {
  const [revision,setRevision]=useState(0)
  const result=useInventory(path,revision)
  return <article className="rounded-xl border border-green-100 bg-white p-6"><h2 className="font-semibold text-green-900">{title}</h2>
    {result.loading?<p role="status" className="mt-4">Loading...</p>:result.error?<><p role="alert" className="mt-3 text-sm text-red-800">{result.error}</p><button className={`${secondaryClass} mt-3`} onClick={()=>setRevision(value=>value+1)}>Retry {title}</button></>:<>
      <p className="mt-4 text-2xl font-bold">{money?php(result.data?.sales_amount):result.data?.total??0}</p>
      {money&&<p className="mt-2 text-sm text-slate-500">{result.data?.transactions??0} transactions · {result.data?.reviewed??0} reviewed · {result.data?.unreviewed??0} unreviewed</p>}
      {result.data?.excluded_records>0&&<p className="mt-2 text-sm text-amber-800">{result.data.excluded_records} records excluded; review report coverage.</p>}
    </>}
  </article>
}
export default function DashboardSummary() {
  const {today,monday}=manilaDates()
  return <section className="mt-8" aria-label="Management summary">
    <p className="mb-4 text-sm text-slate-600">Paid POS sales, including unreviewed transactions. Calendar dates use Asia/Manila.</p>
    <div className="grid gap-4 sm:grid-cols-2"><SummaryCard title="Today's paid sales" money path={`/reports/sales?from=${today}&to=${today}&period=day`}/><SummaryCard title="This week's paid sales" money path={`/reports/sales?from=${monday}&to=${today}&period=week`}/><SummaryCard title="Low-stock products" path="/reports/low-stock?limit=1"/><SummaryCard title="Batches nearing expiry (30-day view)" path="/reports/near-expiry?days=30&limit=1"/></div>
    <Link to="/reports" className="mt-5 inline-block font-semibold text-green-800 underline">Open reports and date filters</Link>
  </section>
}
