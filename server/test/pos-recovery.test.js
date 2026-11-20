import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPosRouter } from '../src/routes/pos.routes.js';
import { createPosRepository } from '../src/repositories/pos.repository.js';
import { errorHandler } from '../src/middleware/error-handler.js';

// Real route/repository code, with deterministic DB responses and serialized
// transactions. This tests protocol decisions, NOT PostgreSQL SQL/locking.
function database() {
  let state={qty:5,sales:[],items:[],payments:[],logs:[]},savepoint,tail=Promise.resolve();
  const control={auditFails:false,loseCommit:false};
  const cents=s=>BigInt(String(s).replace('.','').padEnd(String(s).includes('.')?String(s).length-1:String(s).length+2,'0'));
  const client={async query(sql,v=[]) {
    if(sql.startsWith('SAVEPOINT')){savepoint=structuredClone(state);return {};}
    if(sql.startsWith('ROLLBACK TO')){state=structuredClone(savepoint);return {};}
    if(sql.startsWith('RELEASE SAVEPOINT'))return {};
    if(sql.startsWith('SELECT sale_id,user_id FROM sales'))return {rows:state.sales.filter(s=>s.receipt_no===v[0]).map(s=>({sale_id:s.sale_id,user_id:s.user_id}))};
    if(sql.includes("module='POS_checkout'"))return {rows:state.logs.filter(l=>l.module==='POS_checkout'&&l.action===v[0]).map(l=>({user_id:l.user_id}))};
    if(sql.includes('FROM sales s JOIN users'))return {rows:state.sales.filter(s=>s.sale_id===v[0]&&(v[1]||s.user_id===v[2])).map(s=>({...s}))};
    if(sql.includes('FROM sale_items i JOIN batches') && sql.includes('AS line_total'))return {rows:state.items.filter(i=>i.sale_id===v[0]).map(i=>({...i,product_id:1,product_name:'Fixture',batch_no:'Fixture',expiry_date:'2099-01-01',line_total:(i.quantity*10).toFixed(2)}))};
    if(sql.startsWith('SELECT method,amount_paid'))return {rows:state.payments.filter(p=>p.sale_id===v[0])};
    if(sql.includes('sum(i.quantity)::text AS quantity'))return {rows:[{product_id:1,quantity:String(state.items.filter(i=>i.sale_id===v[0]).reduce((n,i)=>n+i.quantity,0))}]};
    if(sql.includes('count(*)=1 AND bool_and'))return {rows:[{same:state.payments.filter(p=>p.sale_id===v[0]).length===1&&state.payments.some(p=>p.sale_id===v[0]&&cents(p.amount_paid)===cents(v[1]))}]};
    if(sql.includes('ORDER BY product_id FOR UPDATE'))return {rows:[{product_id:1,name:'Fixture',unit_price:'10.00'}]};
    if(sql.startsWith('SELECT p.product_id,p.name')){const q=JSON.parse(v[0])[0].quantity;return {rows:[{product_id:1,name:'Fixture',unit_price:'10.00',quantity:q,line_total:(q*10).toFixed(2)}]};}
    if(sql.startsWith('SELECT sum(round'))return {rows:[{total:(JSON.parse(v[0])[0].quantity*10).toFixed(2)}]};
    if(sql.startsWith('SELECT batch_id,qty_on_hand'))return {rows:state.qty>0?[{batch_id:1,qty_on_hand:state.qty}]:[]};
    if(sql.startsWith('SELECT $1::numeric'))return {rows:[{enough:cents(v[0])>=cents(v[1]),paid:Number(v[0]).toFixed(2),change:Number((cents(v[0])-cents(v[1]))/100n).toFixed(2)}]};
    if(sql.startsWith('INSERT INTO sales')){const s={sale_id:v[0],user_id:v[1],receipt_no:v[2],total_amount:v[3],username:'fixture',approved_by:null,sale_date:'2026-11-20T00:00:00Z'};state.sales.push(s);return {rows:[{sale_id:s.sale_id}]};}
    if(sql.startsWith('UPDATE batches')){if(state.qty<v[1])return {rowCount:0};state.qty-=v[1];return {rowCount:1};}
    if(sql.startsWith('INSERT INTO sale_items')){state.items.push({sale_item_id:v[0],sale_id:v[1],batch_id:v[2],quantity:v[3],unit_price:v[4]});return {rows:[{sale_item_id:v[0]}]};}
    if(sql.startsWith('INSERT INTO payments')){state.payments.push({payment_id:v[0],sale_id:v[1],method:'cash',amount_paid:v[2],change_due:v[3]});return {rows:[{payment_id:v[0]}]};}
    throw Error('Unexpected test query');
  }};
  const users=[1,2,3].map(user_id=>({user_id,username:'fixture',role:user_id===1?'admin':user_id===2?'manager':'employee',status:'active'}));
  const auth={findById:async id=>users.find(u=>u.user_id===id),audit:async(_client,user_id,action,module)=>{
    if(control.auditFails)throw Error('Audit unavailable');state.logs.push({user_id,action,module});
  },async transaction(work){
    const before=tail;let release;tail=new Promise(resolve=>{release=resolve;});await before;const snapshot=structuredClone(state);
    try{const result=await work(client);if(control.loseCommit){control.loseCommit=false;throw Object.assign(Error('Lost response'),{committed:true});}return result;}
    catch(e){if(!e.committed)state=snapshot;throw e;}finally{release();}
  }};
  return {client,auth,control,state:()=>state,setQty:n=>{state.qty=n;}};
}
async function setup(t,db=database()) {
  const app=express();app.use(express.json());app.use(cookieParser());
  const sessions={verify:id=>['1','2','3'].includes(id)?{userId:Number(id),id}:null,revoke(){}};
  app.use(createPosRouter({config:{origin:'http://localhost:5173',secure:false},sessions,authRepository:db.auth,repository:createPosRepository(()=>db.client)}));
  app.use(errorHandler);const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const request=async(path,{body,user='3',origin='http://localhost:5173'}={})=>{
    const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json','X-TGP-Request':'1',...(user?{Cookie:'tgp_session='+user}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,body:await r.json()};
  };
  return {...db,request,post:body=>request('/checkout',{body}),resolve:id=>request('/checkouts/'+id+'/resolve',{body:{}})};
}
const cart=(paid='20.00',quantity=1)=>({request_id:randomUUID(),items:[{product_id:1,quantity}],amount_paid:paid});

test('underpayment closes reference before correction; late retries cannot deduct stock',async t=>{
  const f=await setup(t),old=cart('5.00');const rejected=await f.post(old);
  assert.equal(rejected.status,422);assert.equal(rejected.body.checkout_state,'closed');assert.equal(f.state().sales.length,0);assert.equal(f.state().qty,5);
  assert.equal((await f.request('/checkouts/'+old.request_id)).body.data.status,'closed');
  const corrected=await f.post(cart('20.00'));assert.equal(corrected.status,201);assert.equal(f.state().qty,4);
  for(const request of [old,{...old,amount_paid:'20.00'}])assert.equal((await f.post(request)).body.checkout_state,'closed');
  assert.equal(f.state().sales.length,1);assert.equal(f.state().payments.length,1);assert.equal(f.state().qty,4);
});
test('stock rejection can be corrected using a fresh reference without double posting',async t=>{
  const f=await setup(t);f.setQty(1);const old=cart('30.00',2);
  assert.equal((await f.post(old)).body.checkout_state,'closed');assert.equal(f.state().qty,1);
  assert.equal((await f.post(cart('20.00',1))).status,201);assert.equal(f.state().qty,0);
  assert.equal((await f.post(old)).status,409);assert.equal(f.state().sales.length,1);
});
test('resolve closes unused references but returns existing paid receipt without cancellation',async t=>{
  const f=await setup(t),closed=cart();assert.equal((await f.resolve(closed.request_id)).body.data.status,'closed');
  assert.equal((await f.post(closed)).status,409);
  const paid=cart();const sale=await f.post(paid);assert.equal(sale.status,201);
  const resolution=await f.resolve(paid.request_id);assert.equal(resolution.body.data.status,'completed');
  assert.equal(resolution.body.data.receipt.sale_id,sale.body.data.receipt.sale_id);assert.equal(f.state().qty,4);
});
test('concurrent retry and resolution always leave either one sale or a closed unused reference',async t=>{
  const f=await setup(t),body=cart();const results=await Promise.all([f.post(body),f.resolve(body.request_id),f.post(body)]);
  assert(f.state().sales.length<=1);assert.equal(f.state().qty,5-f.state().sales.length);
  assert.equal(f.state().payments.length,f.state().sales.length);
  if(f.state().sales.length)assert(results.some(r=>r.body.data?.receipt));
  else assert.equal((await f.post(body)).body.checkout_state,'closed');
});
test('closed references survive fresh API/repository instances and owner isolation',async t=>{
  const db=database(),first=await setup(t,db),body=cart('1.00');await first.post(body);
  const fresh=await setup(t,db);assert.equal((await fresh.request('/checkouts/'+body.request_id)).body.data.status,'closed');
  assert.equal((await fresh.request('/checkouts/'+body.request_id,{user:'2'})).body.data.status,'not_found');
  assert.equal((await fresh.request('/checkouts/'+body.request_id+'/resolve',{user:'2',body:{}})).status,404);
  assert.equal((await fresh.post({...body,amount_paid:'20.00'})).status,409);assert.equal(fresh.state().qty,5);
});
test('audit failure or lost commit response never supplies an unsafe editable acknowledgement',async t=>{
  const f=await setup(t),body=cart('1.00');f.control.auditFails=true;
  const failed=await f.post(body);assert.equal(failed.status,500);assert.equal(failed.body.checkout_state,undefined);assert.equal(f.state().logs.length,0);
  f.control.auditFails=false;f.control.loseCommit=true;
  const lost=await f.post(body);assert.equal(lost.status,500);assert.equal(lost.body.checkout_state,undefined);
  assert.equal((await f.resolve(body.request_id)).body.data.status,'closed');assert.equal(f.state().sales.length,0);
});
test('resolution enforces authentication, origin and strict request fields',async t=>{
  const f=await setup(t),id=randomUUID();
  assert.equal((await f.request('/checkouts/'+id+'/resolve',{user:null,body:{}})).status,401);
  assert.equal((await f.request('/checkouts/'+id+'/resolve',{origin:'https://untrusted.example',body:{}})).status,403);
  assert.equal((await f.request('/checkouts/'+id+'/resolve',{body:{force:true}})).status,400);
  assert.equal((await f.request('/checkouts/not-a-uuid/resolve',{body:{}})).status,400);assert.equal(f.state().logs.length,0);
});
