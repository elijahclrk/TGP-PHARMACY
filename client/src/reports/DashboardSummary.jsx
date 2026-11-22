import {Link} from 'react-router-dom'
import {useState} from 'react'
import {useInventory} from '../inventory/useInventory'
import {secondaryClass} from '../inventory/shared'
import {php,manilaDates} from './format'
import {useAuth} from '../auth/auth-context'
import SalesChart from './SalesChart'
import Icon from '../components/Icon'
import {useNotificationPreferences} from '../notifications/preferences'

function SummaryCard({title,path,money=false,icon='box'}) {
  const [revision,setRevision]=useState(0)
  const result=useInventory(path,revision)
  return <article className="surface dashboard-metric"><span className="metric-icon"><Icon name={icon}/></span><h2>{title}</h2>
    {result.loading?<p role="status" className="mt-4">Loading...</p>:result.error?<><p role="alert" className="mt-3 text-sm text-red-800">{result.error}</p><button className={`${secondaryClass} mt-3`} onClick={()=>setRevision(value=>value+1)}>Retry {title}</button></>:<>
      <p className="metric-value mt-4 text-2xl font-bold">{money?php(result.data?.sales_amount):result.data?.total??0}</p>
      {money&&<p className="metric-detail mt-2 text-sm text-slate-500">{result.data?.transactions??0} transactions · {result.data?.reviewed??0} with historical review · {result.data?.unreviewed??0} without historical review</p>}
      {result.data?.excluded_records>0&&<p className="mt-2 text-sm text-amber-800">{result.data.excluded_records} records excluded; review report coverage.</p>}
    </>}
  </article>
}
export default function DashboardSummary() {
  const {today,monday}=manilaDates()
  const {user}=useAuth()
  return <section aria-label="Management summary">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard title="Today's paid sales" money icon="money" path={`/reports/sales?from=${today}&to=${today}&period=day`}/><SummaryCard title="Low-stock products" path="/reports/low-stock?limit=1"/><SummaryCard title="Batches nearing expiry (three-month view)" icon="clock" path="/reports/near-expiry?limit=1"/><SummaryCard title="This week's paid sales" money icon="chart" path={`/reports/sales?from=${monday}&to=${today}&period=week`}/></div>
    <p className="mt-4 text-xs text-slate-600">Completed, reconciled normal cash sales require no manual approval. Calendar dates use Asia/Manila.</p>
    <div className="dashboard-panels mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]"><Trend from={monday} to={today}/><DashboardAlerts/></div>
    {user.role==='admin'&&<div className="dashboard-bottom"><TopProducts from={monday} to={today}/><RecentActivity/></div>}
    <Link to="/reports" className="mt-5 inline-block font-semibold text-red-700 underline">Open reports and date filters</Link>
  </section>
}

function RecentActivity() {
  const [revision,setRevision]=useState(0)
  const result=useInventory('/audit-logs?limit=4',revision)
  return <section className="surface" aria-label="Recent recorded activity"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Recent activity</h2><Link to="/audit-logs" className="text-xs text-red-700">View all</Link></div>
    {result.loading?<p role="status" className="py-8">Loading activity...</p>:result.error?<><p role="alert" className="py-4">{result.error}</p><button className={secondaryClass} onClick={()=>setRevision(value=>value+1)}>Retry activity</button></>:!result.data?.data?.length?<p className="py-8 text-sm text-slate-500">No recorded activity.</p>:<ul>{result.data.data.map(row=><li key={row.log_id} className="activity-item"><Icon name="clock"/><div><p>{row.action ?? 'Not recorded'}</p><small>{row.full_name || row.username || `User #${row.user_id}`} · {row.logged_at ?? 'Time not recorded'} (stored time)</small></div></li>)}</ul>}
  </section>
}

function Trend({from,to}) {
  const [revision,setRevision]=useState(0)
  const [period,setPeriod]=useState('day')
  const result=useInventory(`/reports/sales?from=${from}&to=${to}&period=${period}`,revision)
  const actions=<div className="trend-controls" role="group" aria-label="Sales trend grouping">{[['day','Daily'],['week','Weekly']].map(([value,label])=><button key={value} type="button" aria-pressed={period===value} onClick={()=>setPeriod(value)}>{label}</button>)}</div>
  return <SalesChart title="Sales overview" rows={result.data?.data} actions={actions} loading={result.loading} error={result.error} onRetry={()=>setRevision(value=>value+1)}/>
}
function TopProducts({from,to}) {
  const [revision,setRevision]=useState(0)
  const result=useInventory(`/reports/products?from=${from}&to=${to}&limit=5`,revision)
  return <section className="table-frame" aria-label="Product performance"><h2 className="p-5 font-semibold">Top-selling products this week</h2>{result.loading?<p role="status" className="p-5">Loading product performance...</p>:result.error?<div className="p-5"><p role="alert">{result.error}</p><button className={`${secondaryClass} mt-3`} onClick={()=>setRevision(value=>value+1)}>Retry product performance</button></div>:!result.data?.data?.length?<p className="p-5 text-sm text-slate-500">No qualifying product sales this week.</p>:<table><thead><tr><th>Product</th><th>Units sold</th><th>Paid sales</th></tr></thead><tbody>{result.data.data.map(row=><tr key={row.product_id}><td>{row.name}</td><td>{row.units}</td><td>{php(row.sales_amount)}</td></tr>)}</tbody></table>}</section>
}

function DashboardAlerts() {
  const {user}=useAuth()
  const preferences=useNotificationPreferences(user)
  const [revision,setRevision]=useState(0)
  const low=useInventory('/reports/low-stock?limit=2',revision)
  const expiry=useInventory('/reports/near-expiry?limit=2',revision)
  return <section className="surface"><h2 className="text-lg font-semibold">Needs your attention</h2>
    {low.loading || expiry.loading ? <p role="status" className="py-8 text-sm">Loading inventory alerts...</p> : low.error || expiry.error ? <><p role="alert" className="py-4">{low.error || expiry.error}</p><button className={secondaryClass} onClick={()=>setRevision(value=>value+1)}>Retry inventory alerts</button></> : <ul className="dashboard-alerts">
      {!low.data?.data?.length && !expiry.data?.data?.length && <li>No low-stock or near-expiry records in the current three-month view.</li>}
      {preferences.low_stock&&(low.data?.data || []).map(row=><li key={row.product_id}><div className="flex items-center gap-2"><Icon name="box"/><span>{row.name} is running low</span></div><p>{row.qty_on_hand ?? 'Unknown'} recorded units · Reorder level: {row.reorder_level ?? 'Not set'}</p></li>)}
      {preferences.upcoming_expiry&&(expiry.data?.data || []).map(row=><li key={row.batch_id}><div className="flex items-center gap-2"><Icon name="clock"/><span>{row.product_name} · Batch {row.batch_no}</span></div><p>Expiry: {row.expiry_date} · {row.qty_on_hand ?? 'Unknown'} recorded units</p></li>)}
    </ul>}
    {user.role==='admin'&&<p className="mt-4 text-xs">Optional dashboard reminders follow <Link className="underline" to="/notifications">this browser's preferences</Link>. All safety alerts remain available in Alerts.</p>}
    <div className="mt-4 flex flex-wrap gap-4 text-xs"><Link to="/reports" className="text-red-700">Review low-stock report</Link><Link to="/inventory?status=near_expiry" className="text-red-700">View near-expiry batches</Link></div>
  </section>
}
