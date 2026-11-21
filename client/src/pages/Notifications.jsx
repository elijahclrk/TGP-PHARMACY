import {useState} from 'react'
import {Navigate,Link} from 'react-router-dom'
import {useAuth} from '../auth/auth-context'
import Workspace from '../components/Workspace'
import PageHeading from '../components/PageHeading'
import {secondaryClass} from '../inventory/shared'
import {savePreferences,useNotificationPreferences} from '../notifications/preferences'

export default function Notifications(){
  const {user}=useAuth()
  if(!user)return <Navigate to="/login" replace/>
  if(user.role!=='admin')return <Navigate to={`/${user.role}`} replace/>
  return <AdminPreferences key={user.user_id} user={user}/>
}
function AdminPreferences({user}){
  const preferences=useNotificationPreferences(user)
  const [notice,setNotice]=useState(''),[error,setError]=useState('')
  function change(key,value){
    setNotice('');setError('')
    try{savePreferences(user.user_id,{...preferences,[key]:value});setNotice('Dashboard reminder preferences saved on this browser for your Admin account.')}
    catch{setError('Browser storage is unavailable. Preferences were not confirmed saved. All stock alerts remain available.')}
  }
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
