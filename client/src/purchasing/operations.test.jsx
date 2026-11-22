// @vitest-environment jsdom
import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {AuthContext} from '../auth/auth-context'
import {requestJson} from '../auth/api'
import AccountEdit from '../accounts/AccountEdit'
import Notifications from '../pages/Notifications'
import LinkedReceiving from './LinkedReceiving'
import HistoricalTransaction from '../reports/HistoricalTransaction'
import ProductForm from '../inventory/ProductForm'
vi.mock('../auth/api',()=>({requestJson:vi.fn()}))
afterEach(()=>{cleanup();sessionStorage.clear();localStorage.clear();vi.resetAllMocks()})
function mount(node,role='admin'){render(<MemoryRouter><AuthContext.Provider value={{user:{user_id:3,role},logout:vi.fn()}}>{node}</AuthContext.Provider></MemoryRouter>)}
test('staff editing sends only supported fields, leaves blank password unchanged and displays failures',async()=>{
 const saved=vi.fn();requestJson.mockResolvedValue({success:true});mount(<AccountEdit user={{user_id:1,username:'synthetic_staff',role:'employee',status:'inactive'}} onSaved={saved} onCancel={vi.fn()}/>);const u=userEvent.setup()
 await u.selectOptions(screen.getByLabelText('Staff role'),'manager');await u.selectOptions(screen.getByLabelText('Account status'),'active');await u.click(screen.getByRole('button',{name:'Save account changes'}));expect(saved).toHaveBeenCalledOnce();const[p,o]=requestJson.mock.calls[0];expect(p).toBe('/auth/users/1');expect(JSON.parse(o.body)).toEqual({username:'synthetic_staff',full_name:null,role:'manager',status:'active'});expect(screen.queryByRole('option',{name:'Admin'})).toBeNull()
 requestJson.mockRejectedValueOnce(Error('Update unavailable'));await u.click(screen.getByRole('button',{name:'Save account changes'}));expect((await screen.findByRole('alert')).textContent).toContain('Refresh before retrying')
})
test('durable preferences bind current revision, confirm only server acknowledgement and surface stale conflict',async()=>{
 let revision=0,low=true;requestJson.mockImplementation(async(p,o)=>{if(p==='/operations/availability')return {data:{preferences:true}};if(o?.method==='PUT'){const d=JSON.parse(o.body);expect(d.expected_revision).toBe(revision);if(revision>0)throw Object.assign(Error('conflict'),{status:409});revision++;low=d.low_stock_dashboard}return {data:{low_stock_dashboard:low,upcoming_expiry_dashboard:true,revision}}})
 mount(<Notifications/>);await screen.findByText('Saved on your account across browsers. Mandatory expired/today warnings, POS eligibility and all stock alerts remain unchanged. No external or scheduled notifications.');const u=userEvent.setup();await u.click(await screen.findByRole('checkbox',{name:'Low-stock dashboard reminders'}));await screen.findByText('Account reminder preferences saved.');await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Low-stock dashboard reminders'}).checked).toBe(false));await u.click(screen.getByRole('checkbox',{name:'Low-stock dashboard reminders'}));expect((await screen.findByRole('alert')).textContent).toContain('another session')
})
test('uncertain linked delivery retains its reference across remount and resolves before new submission',async()=>{
 const p={po_id:10,supplier_name:'SYNTHETIC supplier',items:[{po_item_id:11,product_name:'SYNTHETIC product',remaining:4}]},saved=vi.fn();let attempt
 requestJson.mockImplementation(async(path,o)=>{if(o?.method==='POST'&&path==='/operations/stock-ins'){attempt=JSON.parse(o.body).request_id;throw Error('lost response')}if(path.includes('/resolve'))return {data:{status:'recorded',record:{stock_in_id:90}}};return {data:p}})
 const node=<LinkedReceiving id={10} onSaved={saved} onCancel={vi.fn()}/>;mount(node,'manager');await screen.findByText('Supplier: SYNTHETIC supplier');const u=userEvent.setup();await u.type(screen.getByLabelText('Linked delivery reference'),'SYNTHETIC D1');await u.selectOptions(screen.getByLabelText('Ordered product 1'),'11');await u.type(screen.getByLabelText('Linked quantity 1'),'2');await u.type(screen.getByLabelText('Linked batch 1'),'SYNTHETIC B1');fireEvent.change(screen.getByLabelText('Linked expiry 1'),{target:{value:'2099-01-01'}});await u.type(screen.getByLabelText('Linked cost 1'),'50');await u.type(screen.getByLabelText('Linked selling price 1'),'112');await u.click(screen.getByRole('button',{name:'Save linked pending delivery'}));await screen.findByRole('alert');expect(attempt).toBeTruthy();cleanup();mount(node,'manager');await u.click(await screen.findByRole('button',{name:'Resolve delivery attempt'}));await waitFor(()=>expect(saved).toHaveBeenCalledWith({stock_in_id:90}));expect(sessionStorage.getItem('tgp.linked-receiving.3.10')).toBeNull()
})
test('historical internal confirmation shows recorded batch/payment and invokes print without fiscal claim',async()=>{
 requestJson.mockResolvedValue({data:{receipt_no:'SYNTHETIC-RECEIPT',username:'synthetic_staff',sale_date:'2026-11-22T01:00:00Z',total_amount:'112',items:[{sale_item_id:1,product_name:'SYNTHETIC medicine',batch_no:'ORIGINAL',expiry_date:'2099-01-01',quantity:1,unit_price:'112',line_total:'112'}],payments:[{amount_paid:'120',change_due:'8'}]}});const print=vi.spyOn(window,'print').mockImplementation(()=>{});mount(<HistoricalTransaction id={1} onClose={vi.fn()}/>);await screen.findByText('SYNTHETIC-RECEIPT');await userEvent.click(screen.getByRole('button',{name:'Print transaction confirmation'}));expect(print).toHaveBeenCalledOnce();expect(screen.getByText(/Fiscal receipt requirements remain subject/)).toBeTruthy();print.mockRestore()
})
test('optional strength stays explicit and is submitted only after local metadata capability is available',async()=>{
 requestJson.mockImplementation(async(p)=>p==='/operations/availability'?{data:{metadata:true}}:{data:{product_id:1}});const saved=vi.fn();mount(<ProductForm product={{product_id:1,name:'SYNTHETIC medicine',unit_price:'112'}} admin onSaved={saved} onCancel={vi.fn()}/>);const u=userEvent.setup();await u.type(await screen.findByLabelText('Strength / dosage form (verified text)'),'SYNTHETIC 10 mg tablet');await u.click(screen.getByRole('button',{name:'Save product'}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(JSON.parse(requestJson.mock.calls.find(([,o])=>o?.method==='PATCH')[1].body).strength_dosage).toBe('SYNTHETIC 10 mg tablet')
})
