import {useSyncExternalStore} from 'react'

const defaults=Object.freeze({low_stock:true,upcoming_expiry:true})
export const preferenceKey=userId=>`tgp.dashboard-reminders.v1.${userId}`
const changed='tgp:dashboard-reminders'
export function decodePreferences(raw){
  if(raw===null)return {...defaults}
  try{const value=JSON.parse(raw);if(value.version!==1||typeof value.low_stock!=='boolean'||typeof value.upcoming_expiry!=='boolean')return {...defaults}
    return {low_stock:value.low_stock,upcoming_expiry:value.upcoming_expiry}
  }catch{return {...defaults}}
}
export function savePreferences(userId,preferences){
  if(!Number.isInteger(userId)||userId<1||typeof preferences.low_stock!=='boolean'||typeof preferences.upcoming_expiry!=='boolean')throw new Error('Invalid reminder preferences.')
  const key=preferenceKey(userId),raw=JSON.stringify({version:1,low_stock:preferences.low_stock,upcoming_expiry:preferences.upcoming_expiry})
  localStorage.setItem(key,raw)
  if(localStorage.getItem(key)!==raw)throw new Error('Preferences could not be saved on this browser.')
  window.dispatchEvent(new Event(changed))
}
const subscribe=listener=>{window.addEventListener(changed,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(changed,listener);window.removeEventListener('storage',listener)}}
export function useNotificationPreferences(user){
  const enabled=user?.role==='admin'&&Number.isInteger(user.user_id)
  const raw=useSyncExternalStore(subscribe,()=>{try{return enabled?localStorage.getItem(preferenceKey(user.user_id)):null}catch{return null}},()=>null)
  return decodePreferences(raw)
}
