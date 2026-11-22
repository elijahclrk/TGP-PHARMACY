export function receivingSummary(lines) {
  const quantities = lines.map(line => String(line.quantity ?? ''))
  if (!lines.length || quantities.some(value => !/^\d+$/.test(value) || BigInt(value) < 1n || BigInt(value) > 2147483647n)) return { units: null, cost: null }
  const units = quantities.reduce((sum, value) => sum + BigInt(value), 0n).toString()
  const costs = lines.map(line => String(line.cost_price ?? line.unit_cost ?? ''))
  if (costs.some(value => value.length > 40 || !/^\d+(\.\d+)?$/.test(value))) return { units, cost: null }
  const scale = Math.max(...costs.map(value => (value.split('.')[1] || '').length))
  const total = costs.reduce((sum, value, index) => {
    const [whole, fraction = ''] = value.split('.')
    return sum + BigInt(whole + fraction.padEnd(scale, '0')) * BigInt(quantities[index])
  }, 0n)
  const digits = total.toString().padStart(scale + 1, '0')
  return { units, cost: scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits }
}
