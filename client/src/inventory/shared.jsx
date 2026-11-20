export const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100'
export const buttonClass = 'rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50'
export const secondaryClass = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

export function Field({ label, id, ...props }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">{label}</label><input id={id} className={fieldClass} {...props} /></div>
}
export function StockBadge({ product }) {
  const unknown = product.qty_on_hand === null
  const zero = !unknown && Number(product.qty_on_hand) === 0
  const text = unknown ? 'Quantity unknown' : zero ? 'Out of stock' : product.low_stock ? 'Low stock' : 'In stock'
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${unknown || zero ? 'bg-slate-100 text-slate-700' : product.low_stock ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>{text}</span>
}
export function ExpiryBadge({ batch, days }) {
  const text = batch.days_to_expiry === null ? 'Expiry unknown' : batch.days_to_expiry < 0 ? 'Expired' : batch.days_to_expiry <= days ? 'Near expiry' : 'Within date'
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${text === 'Expired' ? 'bg-red-50 text-red-800' : text === 'Near expiry' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{text}</span>
}
export function Paging({ data, onPage }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
    <span>{data.total} results · Page {data.page} of {Math.max(1, Math.ceil(data.total / data.limit))}</span>
    <div className="flex gap-2"><button className={secondaryClass} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button><button className={secondaryClass} disabled={data.page * data.limit >= data.total} onClick={() => onPage(data.page + 1)}>Next</button></div>
  </div>
}
export function QueryState({ result, retry, empty }) {
  if (result.loading) return <p role="status" className="p-10 text-center text-slate-500">Loading…</p>
  if (result.error) return <div className="p-8 text-center"><p role="alert" className="mb-4 text-red-800">{result.error}</p><button className={secondaryClass} onClick={retry}>Try again</button></div>
  if (!result.data?.data.length) return <div className="px-6 py-14 text-center"><h2 className="font-semibold text-slate-800">{empty}</h2><p className="mt-2 text-sm text-slate-500">Try another search or check your filters.</p></div>
  return null
}
