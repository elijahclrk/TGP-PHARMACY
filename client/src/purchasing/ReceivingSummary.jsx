import { receivingSummary } from './receiving-summary'
import { formatPHP } from '../utils/money'

export default function ReceivingSummary({ lines, draft = false }) {
  const summary = receivingSummary(lines)
  return <section className="receiving-summary" aria-label={draft ? 'Draft receiving summary' : 'Recorded receiving summary'}>
    <div><p className="text-xs text-slate-600">{draft ? 'Draft batch lines' : 'Recorded batch lines'}</p><p className="mt-1 text-xl font-semibold">{lines.length}</p></div>
    <div><p className="text-xs text-slate-600">Total units</p><p className="mt-1 text-xl font-semibold">{summary.units ?? 'Incomplete'}</p></div>
    <div><p className="text-xs text-slate-600">Total receiving cost{draft ? ' (preview)' : ''}</p><p className="mt-1 text-xl font-semibold">{formatPHP(summary.cost)}</p></div>
    <p className="w-full text-xs text-slate-600">{draft ? 'Quantity × entered cost, rounded for display only. Complete all required fields before saving. This preview does not post stock.' : 'Quantity × recorded unit cost. This is receiving cost, not retail value or an additional charge.'}</p>
  </section>
}
