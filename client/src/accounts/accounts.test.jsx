// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { requestJson } from '../auth/api'
import Users from '../pages/Users'
import AccountForm from './AccountForm'

vi.mock('../auth/api', () => ({ requestJson: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const admin = {user_id:1,username:'fixture_admin',full_name:'Fixture Admin',role:'admin',status:'active'}
const employee = {user_id:2,username:'fixture_employee',full_name:'Fixture Employee',role:'employee',status:'active'}
const inactive = {user_id:3,username:'fixture_inactive',full_name:null,role:'manager',status:'inactive'}
const page = data => ({data,total:data.length,page:1,limit:20})
function mount(node = <Users/>, role = 'admin') {
  return render(<MemoryRouter initialEntries={['/users']}><AuthContext.Provider value={{user:{...admin,role},logout:vi.fn()}}>{node}</AuthContext.Provider></MemoryRouter>)
}
test('Admin sees wireframe columns, searches accounts and never renders private response fields', async () => {
  requestJson.mockResolvedValue(page([{...employee,password_hash:'private-fixture-not-for-display'}]))
  mount()
  await screen.findByRole('button',{name:'View account fixture_employee'})
  const table = screen.getByRole('table',{name:'Staff accounts'})
  expect(within(table).getAllByRole('columnheader').map(cell=>cell.textContent)).toEqual(['User','Username','Role','Status'])
  expect(document.body.textContent.includes('private-fixture-not-for-display')).toBe(false)
  expect(screen.getByRole('link',{name:'User accounts'}).getAttribute('aria-current')).toBe('page')
  await userEvent.type(screen.getByLabelText('Search users'),'Fixture')
  await userEvent.click(screen.getByRole('button',{name:'Search users'}))
  await waitFor(()=>expect(requestJson.mock.calls.filter(([path])=>path.startsWith('/auth/users?')).at(-1)[0]).toContain('q=Fixture'))
})
test.each(['employee','manager'])('%s cannot render account management or trigger account API requests', role => {
  mount(<Users/>,role)
  expect(requestJson).not.toHaveBeenCalled()
  expect(screen.queryByRole('button',{name:'Add user'})).toBeNull()
})
test('Admin creation uses existing fields, supported roles and clears the entered password', async () => {
  const saved = vi.fn()
  requestJson.mockResolvedValue({user:employee})
  mount(<AccountForm onSaved={saved} onCancel={vi.fn()}/>)
  const user = userEvent.setup()
  expect(screen.queryByRole('option',{name:'Admin'})).toBeNull()
  await user.type(screen.getByLabelText('Username'),'new_fixture')
  await user.type(screen.getByLabelText('Full name (optional)'),'Fixture New Staff')
  await user.selectOptions(screen.getByLabelText('Role'),'manager')
  await user.type(screen.getByLabelText('Initial password'),'synthetic-test-only-password')
  await user.click(screen.getByRole('button',{name:'Create account'}))
  await waitFor(()=>expect(saved).toHaveBeenCalledOnce())
  const [path,options] = requestJson.mock.calls[0], body = JSON.parse(options.body)
  expect(path).toBe('/auth/users'); expect(options.method).toBe('POST')
  expect(Object.keys(body).sort()).toEqual(['full_name','password','role','username'])
  expect(body.role).toBe('manager'); expect(body.username).toBe('new_fixture')
  expect(screen.getByLabelText('Initial password').value).toBe('')
})
test('creation uncertainty clears the password and asks Admin to check the list before retrying', async () => {
  requestJson.mockRejectedValue(new Error('network'))
  mount(<AccountForm onSaved={vi.fn()} onCancel={vi.fn()}/>)
  await userEvent.type(screen.getByLabelText('Username'),'new_fixture')
  await userEvent.type(screen.getByLabelText('Initial password'),'synthetic-test-only-password')
  await userEvent.click(screen.getByRole('button',{name:'Create account'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Search or refresh the account list')
  expect(screen.getByLabelText('Initial password').value).toBe('')
  expect(requestJson).toHaveBeenCalledTimes(1)
})
test('Admin must confirm deactivation; success refreshes details and removes the action', async () => {
  let deactivated = false
  requestJson.mockImplementation(async (path,options)=>{
    if(options?.method==='POST'){deactivated=true;return {success:true,user:{...employee,status:'inactive'}}}
    const row={...employee,status:deactivated?'inactive':'active'}
    return path.includes('?')?page([row]):{user:row}
  })
  mount()
  await userEvent.click(await screen.findByRole('button',{name:'View account fixture_employee'}))
  await userEvent.click(await screen.findByRole('button',{name:'Deactivate account'}))
  expect(requestJson.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false)
  await userEvent.click(screen.getByRole('button',{name:'Keep account active'}))
  await userEvent.click(screen.getByRole('button',{name:'Deactivate account'}))
  await userEvent.click(screen.getByRole('button',{name:'Confirm deactivation'}))
  await screen.findByText('Account deactivated. Active sessions revoked.')
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Deactivate account'})).toBeNull())
  const call = requestJson.mock.calls.find(([,options])=>options?.method==='POST')
  expect(call[0]).toBe('/auth/users/2/deactivate'); expect(call[1].body).toBe('{}')
})
test.each([admin,inactive])('Admin/inactive accounts remain viewable without unsupported controls ($username)', async row => {
  requestJson.mockImplementation(async path=>path.includes('?')?page([row]):{user:row})
  mount()
  await userEvent.click(await screen.findByRole('button',{name:`View account ${row.username}`}))
  await screen.findByRole('region',{name:'Account details'})
  await waitFor(()=>expect(screen.queryByText('Loading account...')).toBeNull())
  for(const name of [/Deactivate account/,/Reactivate/,/Reset password/,/Delete/,/Change role/]) expect(screen.queryByRole('button',{name})).toBeNull()
})
test('accounts show loading, safe failure/retry, empty and pagination states', async () => {
  requestJson.mockImplementationOnce(()=>new Promise(()=>{}))
  const view=mount(); expect(screen.getByRole('status').textContent).toMatch(/Loading/);view.unmount()
  requestJson.mockRejectedValueOnce(new Error('network')).mockResolvedValue({...page([]),total:21})
  mount(); await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button',{name:'Try again'}))
  await screen.findByText('No accounts found')
  await userEvent.click(screen.getByRole('button',{name:'Next'}))
  await waitFor(()=>expect(requestJson.mock.calls.at(-1)[0]).toContain('page=2'))
})
