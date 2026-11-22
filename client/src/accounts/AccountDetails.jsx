import { useState } from 'react'
import { requestJson } from '../auth/api'
import { useInventory } from '../inventory/useInventory'
import { buttonClass, secondaryClass } from '../inventory/shared'
import { roleLabel, statusLabel } from './labels'
import Modal from '../components/Modal'
import AccountEdit from './AccountEdit'

export default function AccountDetails({ id, revision, currentUserId, onDeactivated, onUpdated, onClose }) {
  const [editing,setEditing]=useState(false)
  const [retry, setRetry] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const result = useInventory(`/auth/users/${id}`, `${revision}:${retry}`)
  const user = result.data?.user
  async function deactivate() {
    setPending(true); setError('')
    try {
      await requestJson(`/auth/users/${id}/deactivate`, { method: 'POST', body: '{}' })
      setConfirm(false); onDeactivated()
    } catch (failure) {
      setError(failure.status ? failure.message : 'Deactivation could not be confirmed. Refresh account details before retrying.')
      setConfirm(false); setRetry(value => value + 1)
    } finally { setPending(false) }
  }
  return <Modal title="Account details" onClose={onClose} busy={pending}><section aria-label="Account details">
    <div className="flex justify-end"><button type="button" className={secondaryClass} disabled={pending} onClick={() => { setConfirm(false); setRetry(value => value + 1) }}>Refresh details</button></div>
    {result.loading ? <p role="status" className="py-6">Loading account...</p> : result.error ? <p role="alert" className="mt-4 text-red-800">{result.error}</p> : user && <>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">{[['User',user.full_name || 'Not set'],['Username',user.username],['Role',roleLabel(user.role)],['Status',statusLabel(user.status)]].map(([label,value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
      <p className="mt-3 text-sm">Last recorded sign-in (Manila): {user.last_sign_in?new Date(user.last_sign_in).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):'Not recorded'}. This is an audited sign-in, not a live presence indicator.</p>
      {user.user_id!==currentUserId&&['employee','manager'].includes(user.role)&&(editing?<AccountEdit user={user} onCancel={()=>setEditing(false)} onSaved={()=>{setEditing(false);setRetry(n=>n+1);onUpdated?.()}}/>:<button className={`${secondaryClass} mt-5`} onClick={()=>setEditing(true)}>Edit account</button>)}
      {user.user_id !== currentUserId && ['employee','manager'].includes(user.role) && user.status === 'active' && <div className="mt-6 border-t border-slate-200 pt-5">
        {confirm ? <div role="group" aria-label="Confirm account deactivation"><p className="mb-4 text-sm">Deactivate {user.username}? This prevents sign-in and revokes the account’s active sessions. Existing transaction history is preserved.</p><div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={pending} onClick={deactivate}>{pending ? 'Deactivating...' : 'Confirm deactivation'}</button><button type="button" className={secondaryClass} disabled={pending} onClick={() => setConfirm(false)}>Keep account active</button></div></div> : <button type="button" className={secondaryClass} onClick={() => setConfirm(true)}>Deactivate account</button>}
      </div>}
      {user.role === 'admin' && <p className="mt-5 text-xs text-slate-500">Administrator accounts are read-only in this interface.</p>}
    </>}
    {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
  </section></Modal>
}
