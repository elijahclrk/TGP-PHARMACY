// Display-only rounding. Never use a formatted value as a transaction payload.
export function formatPHP(value) {
  if (value === null || value === undefined || !/^-?\d+(\.\d+)?$/.test(String(value))) return 'Unavailable'
  const text = String(value)
  const negative = text.startsWith('-')
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.')
  let minor = BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, '0'))
  if ((fraction[2] || '0') >= '5') minor += 1n
  const units = String(minor / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `PHP ${negative && minor !== 0n ? '-' : ''}${units}.${String(minor % 100n).padStart(2, '0')}`
}
