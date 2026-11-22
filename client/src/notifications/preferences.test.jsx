// @vitest-environment jsdom
import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {AuthContext} from '../auth/auth-context'
import Notifications from '../pages/Notifications'
import {decodePreferences,preferenceKey,savePreferences} from './preferences'
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()})
function mount(id=1,role='admin'){render(<MemoryRouter><AuthContext.Provider value={{user:{user_id:id,role,username:'Synthetic'},logout:vi.fn()}}><Notifications/></AuthContext.Provider></MemoryRouter>)}
test('Admin reminder preferences are explicit browser-local booleans, persist for self and do not transfer to another account',async()=>{
  mount();const low=screen.getByRole('checkbox',{name:'Low-stock dashboard reminders'});expect(low.checked).toBe(true)
  await userEvent.click(low);expect(low.checked).toBe(false)
  expect(JSON.parse(localStorage.getItem(preferenceKey(1)))).toEqual({version:1,low_stock:false,upcoming_expiry:true})
  expect(screen.getByText(/not pharmacy-wide/)).toBeTruthy();cleanup();mount();expect(screen.getByRole('checkbox',{name:'Low-stock dashboard reminders'}).checked).toBe(false)
  cleanup();mount(2);expect(screen.getByRole('checkbox',{name:'Low-stock dashboard reminders'}).checked).toBe(true)
})
test('storage failure is reported without claiming durable or server-side settings',async()=>{
  mount();vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')})
  await userEvent.click(screen.getByRole('checkbox',{name:'Low-stock dashboard reminders'}));expect(screen.getByRole('alert').textContent).toContain('not confirmed saved')
})
test('corrupt versions/defaults and unrecognized data never suppress safety behavior or store beneficiary data',()=>{
  for(const raw of ['invalid','{"version":2,"low_stock":false}','{"version":1,"low_stock":"false","upcoming_expiry":false}'])expect(decodePreferences(raw)).toEqual({low_stock:true,upcoming_expiry:true})
  savePreferences(1,{low_stock:false,upcoming_expiry:true,customer_id:'NEVER STORE'})
  expect(localStorage.getItem(preferenceKey(1))).not.toContain('NEVER STORE')
  expect(()=>savePreferences(0,{low_stock:true,upcoming_expiry:true})).toThrow()
})
test.each(['employee','manager'])('%s cannot access the Admin preference interface',role=>{mount(1,role);expect(screen.queryByRole('heading',{name:'Notification preferences'})).toBeNull()})
