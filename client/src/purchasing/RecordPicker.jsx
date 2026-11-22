import { useState } from 'react'
import { useInventory } from '../inventory/useInventory'
import { fieldClass } from '../inventory/shared'

export default function RecordPicker({ label, path, idKey, onSelect }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const result = useInventory(`${path}?q=${encodeURIComponent(search)}&limit=20`)
  return <div className="min-w-48">
    <label className="block text-sm font-medium">{label}
      <input aria-label={`Search ${label.toLowerCase()}`} className={`${fieldClass} mt-2`} value={search} maxLength={200}
        placeholder={`Search ${label.toLowerCase()}`} onChange={event => setSearch(event.target.value)} />
    </label>
    <select aria-label={label} required className={`${fieldClass} mt-2`} value={selected?.[idKey] || ''} onChange={event => {
      const row = result.data?.data.find(item => item[idKey] === Number(event.target.value))
      setSelected(row || null); onSelect(row?.[idKey] || null)
    }}>
      <option value="">Choose {label.toLowerCase()}</option>
      {selected && !result.data?.data.some(item => item[idKey] === selected[idKey]) && <option value={selected[idKey]}>{selected.name}</option>}
      {!result.loading && result.data?.data.map(item => <option key={item[idKey]} value={item[idKey]}>{item.name} (#{item[idKey]})</option>)}
    </select>
    <p className="mt-1 text-xs text-slate-500">{result.loading ? 'Loading choices...' : result.error || (result.data?.total ? `${result.data.total} matches. Refine search if needed.` : 'No matches. Create a record first.')}</p>
  </div>
}
