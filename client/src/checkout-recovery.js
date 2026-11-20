// No tokens or credentials. Persist the exact request before any checkout HTTP.
export const recoveryKey = userId => `tgp.checkout.v1.${userId}`
export function loadCheckout(userId) {
  const raw=localStorage.getItem(recoveryKey(userId))
  if(!raw)return null
  const value=JSON.parse(raw)
  if(!value || typeof value.request_id!=='string' || typeof value.amount_paid!=='string' || !Array.isArray(value.items))throw new Error('Stored checkout needs operator recovery.')
  return value
}
export function saveCheckout(userId,payload) {
  const value=JSON.stringify(payload)
  localStorage.setItem(recoveryKey(userId),value)
  if(localStorage.getItem(recoveryKey(userId))!==value)throw new Error('Checkout recovery storage unavailable.')
}
export function clearCheckout(userId) {localStorage.removeItem(recoveryKey(userId))}
