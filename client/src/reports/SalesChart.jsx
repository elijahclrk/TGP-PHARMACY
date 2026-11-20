import { useId } from 'react'
import { php } from './format'
import { secondaryClass } from '../inventory/shared'

// Convert exact decimal strings to integer cents; only a bounded visual ratio uses Number.
function cents(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) return null
  const [whole, fraction = ''] = String(value).split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export default function SalesChart({ rows = [], title = 'Sales trend', actions, loading = false, error, onRetry }) {
  const gradient = useId()
  const points = rows.map(row => ({ ...row, cents: cents(row.sales_amount) })).filter(row => row.cents !== null)
  const max = points.reduce((value, row) => row.cents > value ? row.cents : value, 0n)
  const width = Math.max(640, points.length * 64)
  const coordinates = points.map((row, index) => ({ ...row, x: points.length === 1 ? width / 2 : 40 + index * (width - 70) / (points.length - 1), y: 190 - (max ? Number(row.cents * 10000n / max) / 10000 * 150 : 0) }))
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  return <section className="surface sales-trend-panel" aria-label={title}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2>{actions}</div><p className="mt-2 text-xs text-slate-500">Fully paid sales by period, Asia/Manila.</p>
    {loading ? <p role="status" className="py-12 text-sm text-slate-500">Loading sales trend...</p> : error ? <div className="py-8"><p role="alert">{error}</p><button className={`${secondaryClass} mt-3`} onClick={onRetry}>Retry sales trend</button></div> : !points.length ? <p className="py-12 text-center text-sm text-slate-500">No sales trend data for this range.</p> : <>
      <div className="sales-chart" aria-hidden="true"><svg className="sales-area" viewBox={`0 0 ${width} 235`} style={{ minWidth: width }}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d92d30" stopOpacity=".16"/><stop offset="100%" stopColor="#d92d30" stopOpacity=".01"/></linearGradient></defs>
        {[40,90,140,190].map(y => <line key={y} x1="30" x2={width-15} y1={y} y2={y} stroke="#edf0f4" strokeDasharray="4 4"/>)}
        <path d={`${line} L ${coordinates.at(-1).x} 190 L ${coordinates[0].x} 190 Z`} fill={`url(#${gradient})`}/><path d={line} fill="none" stroke="#d92d30" strokeWidth="2"/>
        {coordinates.map((row,index) => <g key={index}><circle className="sales-chart-point" cx={row.x} cy={row.y} r="3" fill="#d92d30"><title>{row.period_start}: {php(row.sales_amount)}</title></circle><text x={row.x} y="220" textAnchor="middle" fill="#9299a7" fontSize="10">{String(row.period_start).slice(5,10)}</text></g>)}
      </svg></div><p className="chart-legend"><i aria-hidden="true"/>Paid sales</p>
      <ul className="sr-only">{points.map((row,index) => <li key={index}>{row.period_start}: {php(row.sales_amount)}</li>)}</ul>
    </>}
  </section>
}
