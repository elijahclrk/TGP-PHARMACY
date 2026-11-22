import {useState} from 'react'
import {requestJson} from '../auth/api'
import {Field,buttonClass,secondaryClass} from '../inventory/shared'

export default function AccountEdit({user,onSaved,onCancel}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(e){e.preventDefault();const f=new FormData(e.currentTarget),body={username:f.get('username'),full_name:f.get('full_name')||null,role:f.get('role'),status:f.get('status')};if(f.get('password'))body.password=f.get('password');e.currentTarget.elements.password.value='';setBusy(true);setError('')
  try{await requestJson(`/auth/users/${user.user_id}`,{method:'PATCH',body:JSON.stringify(body)});onSaved()}
  catch(e){setError(e.status?e.message:'Account update could not be confirmed. Refresh before retrying.')}
  finally{setBusy(false)}
 }
 return <form aria-label="Edit staff account" onSubmit={submit} className="mt-5 space-y-4"><fieldset disabled={busy} className="space-y-4">
  <Field label="Staff username" name="username" id="edit-username" defaultValue={user.username} required maxLength={64} pattern="[a-zA-Z0-9_.-]+"/>
  <Field label="Staff full name" name="full_name" id="edit-full-name" defaultValue={user.full_name||''} maxLength={120}/>
  <label className="block">Staff role<select className="block w-full border p-2" name="role" defaultValue={user.role}><option value="employee">Employee</option><option value="manager">Manager</option></select></label>
  <label className="block">Account status<select className="block w-full border p-2" name="status" defaultValue={user.status}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
  <Field label="Replacement password (leave blank to retain)" name="password" id="edit-password" type="password" autoComplete="new-password" minLength={12} maxLength={128}/>
  <p className="text-sm">Saving revokes this staff member's active sessions. Transaction history is retained. Administrator accounts require a separate owner procedure.</p>
  <button className={buttonClass}>{busy?'Saving...':'Save account changes'}</button> <button type="button" className={secondaryClass} onClick={onCancel}>Cancel account edit</button>
 </fieldset>{error&&<p role="alert">{error}</p>}</form>
}
