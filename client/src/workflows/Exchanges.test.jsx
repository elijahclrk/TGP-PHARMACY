// @vitest-environment jsdom
import {test,expect,vi,afterEach} from 'vitest'
import {render,screen,cleanup,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {AuthContext} from '../auth/auth-context'
import {useInventory} from '../inventory/useInventory'
import {requestJson} from '../auth/api'
import Exchanges from './Exchanges'
vi.mock('../inventory/useInventory',()=>({useInventory:vi.fn()}))
vi.mock('../auth/api',()=>({requestJson:vi.fn(),downloadReport:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks();sessionStorage.clear()})
function mount(available=true){useInventory.mockImplementation(path=>({loading:false,data:path.includes('availability')?{data:{available}}:path.includes('/products')?{data:{data:[{product_id:1,name:'SYNTHETIC product',unit_price:'112.00',available:10}]}}:{data:[]}}));return render(<AuthContext.Provider value={{user:{user_id:1,role:'employee'}}}><Exchanges/></AuthContext.Provider>)}
test('disabled production exchange capability exposes no working exchange actions',()=>{mount(false);expect(screen.queryByRole('region',{name:'Product exchanges'})).toBeNull();expect(requestJson).not.toHaveBeenCalled()})
test('editing reviewed exchange input removes the submit action and requires a fresh quote',async()=>{
 const user=userEvent.setup();requestJson.mockImplementation(async path=>({data:path.includes('/sources')?[{sale_item_id:10,product_name:'Original',batch_no:'SYNTHETIC batch',return_id:20,accepted:2,received_quantity:2,decision_state:'approved',allocated:'0'}]:{financial:{return_value:'112.00',replacement_value:'112.00',additional_cash:'0.00'},quote_token:'synthetic-token'}}));mount();
 await user.type(screen.getByLabelText('Exchange original receipt'),'POS-SYNTHETIC');await user.click(screen.getByRole('button',{name:'Find exchange source'}));await user.type(await screen.findByLabelText('Exchange quantity for return 20'),'1');await user.click(screen.getByRole('button',{name:'Add replacement SYNTHETIC product'}));await user.type(screen.getByLabelText('Exchange reason'),'SYNTHETIC voluntary');await user.click(screen.getByRole('button',{name:'Review replacement quote'}));await screen.findByRole('button',{name:'Submit reviewed exchange'});expect(screen.getByText('Additional cash payable: PHP 0.00')).toBeTruthy();await user.type(screen.getByLabelText('Exchange reason'),' amended');expect(screen.queryByRole('button',{name:'Submit reviewed exchange'})).toBeNull();
})
test('saved uncertain operation locks new requests until serialized recovery, storing only opaque references',async()=>{
 const id='12345678-1234-4234-8234-123456789abc';sessionStorage.setItem('tgp-exchange-attempt:1',JSON.stringify({operation:'post',exchange_id:id,request_id:id}));requestJson.mockResolvedValue({data:{status:'closed'}});mount();expect(screen.getByLabelText('Exchange original receipt').closest('fieldset').disabled).toBe(true);await userEvent.click(screen.getByRole('button',{name:'Check exchange outcome'}));await waitFor(()=>expect(sessionStorage.getItem('tgp-exchange-attempt:1')).toBeNull());expect(requestJson.mock.calls[0][0]).toBe('/exchanges/'+id+'/resolve');expect(screen.getByLabelText('Exchange original receipt').closest('fieldset').disabled).toBe(false);
})
