import {useState} from 'react'
import {Navigate,Link} from 'react-router-dom'
import {useAuth} from '../auth/auth-context'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import {secondaryClass} from '../inventory/shared'
import {savePreferences,useNotificationPreferences} from '../notifications/preferences'
import {useOperations} from '../inventory/useOperations'
import {useInventory} from '../inventory/useInventory'
import {requestJson} from '../auth/api'

export default function Notifications(){
  const {user}=useAuth()
  if(!user)return <Navigate to="/login" replace/>
  if(user.role!=='admin')return <Navigate to={`/${user.role}`} replace/>
  return <AdminPreferences key={user.user_id} user={user}/>
}
function AdminPreferences({user}){
  const capabilities=useOperations()
  const preferences=useNotificationPreferences(user)
  const [notice,setNotice]=useState(''),[error,setError]=useState('')
  function change(key,value){
    setNotice('');setError('')
    try{savePreferences(user.user_id,{...preferences,[key]:value});setNotice('Dashboard reminder preferences saved on this browser for your Admin account.')}
    catch{setError('Browser storage is unavailable. Preferences were not confirmed saved. All stock alerts remain available.')}
  }
  if(capabilities.preferences)return <DurablePreferences user={user}/>
  return <Workspace><PageHeading title="Notification preferences" description="Choose optional reminders on your Admin dashboard."/>
    <section className="surface space-y-5" aria-label="Dashboard reminder preferences">
      <p>These display preferences apply only to your Admin account on this browser. They are not pharmacy-wide or shared across devices. Clearing browser storage resets them to enabled.</p>
      <label className="flex items-center gap-3"><input type="checkbox" checked={preferences.low_stock} onChange={event=>change('low_stock',event.target.checked)}/>Low-stock dashboard reminders</label>
      <label className="flex items-center gap-3"><input type="checkbox" checked={preferences.upcoming_expiry} onChange={event=>change('upcoming_expiry',event.target.checked)}/>Upcoming-expiry dashboard reminders</label>
      <p>Stock alerts, expired/today warnings, stock calculations, approvals, reports and sales safeguards remain unchanged. No SMS, email, push, scheduled digest or read/dismiss service is enabled.</p>
      {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
      <Link className={secondaryClass} to="/alerts">Open all stock alerts</Link>
    </section>
    <p className="mt-5 text-sm">Durable account settings and other reminder types require a separately reviewed migration and implementation; they are unavailable.</p>
  </Workspace>
}
function DurablePreferences({user}){
 const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[choice,setChoice]=useState(null)
 const result=useInventory('/operations/notification-preferences',revision),p=choice||result.data?.data
 async function change(key,value){setChoice({...p,[key]:value});setBusy(true);setError('');setNotice('');try{const r=await requestJson('/operations/notification-preferences',{method:'PUT',body:JSON.stringify({expected_revision:p.revision,low_stock_dashboard:p.low_stock_dashboard,upcoming_expiry_dashboard:p.upcoming_expiry_dashboard,[key]:value})});setChoice(r.data);try{savePreferences(user.user_id,{low_stock:r.data.low_stock_dashboard,upcoming_expiry:r.data.upcoming_expiry_dashboard})}catch{/* Server acknowledgement remains authoritative without browser storage. */}setNotice('Account reminder preferences saved.')}catch(e){setChoice(null);setError(e.status===409?'Preferences changed in another session. Reloaded current settings; review before saving.':e.message)}finally{setBusy(false);setRevision(n=>n+1)}}
 return <Workspace><PageHeading title="Notification preferences" description="Persistent preferences for your Admin account."/><section className="surface space-y-5" aria-label="Dashboard reminder preferences">
  {result.loading&&<p role="status">Loading preferences...</p>}{result.error&&<p role="alert">{result.error}</p>}
  {p&&(!result.loading||busy)&&<fieldset disabled={busy} className="space-y-4"><label className="block"><input type="checkbox" checked={p.low_stock_dashboard} onChange={e=>change('low_stock_dashboard',e.target.checked)}/> Low-stock dashboard reminders</label><label className="block"><input type="checkbox" checked={p.upcoming_expiry_dashboard} onChange={e=>change('upcoming_expiry_dashboard',e.target.checked)}/> Upcoming-expiry dashboard reminders</label></fieldset>}
  {busy&&<p role="status">Saving preferences...</p>}
  <p>Saved on your account across browsers. Mandatory expired/today warnings, POS eligibility and all stock alerts remain unchanged. No external or scheduled notifications.</p>
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}<Link className={secondaryClass} to="/alerts">Open all stock alerts</Link>
 </section></Workspace>
}
