import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import {randomUUID} from 'node:crypto';
import {createWorkflowsRouter} from '../src/routes/workflows.routes.js';
import {createSessions} from '../src/services/sessions.js';
import {errorHandler} from '../src/middleware/error-handler.js';
async function fixture(t,{enabled=true,ready=true,restockingEnabled=false}={}){
  const users=[{user_id:1,role:'employee',status:'active'},{user_id:2,role:'manager',status:'active'},{user_id:3,role:'admin',status:'active'}],calls=[];
  const config={secret:'synthetic-workflow-http-test-secret-2026',ttl:900,origin:'http://localhost:5173',secure:false},sessions=createSessions(config);
  const cookies=users.map(u=>'tgp_session='+sessions.issue(u.user_id).token);
  const repository={async schemaReady(){calls.push('ready');return ready;},async list(kind,actor,q){calls.push({kind,actor,q});return {data:[],total:0,page:q.page,limit:q.limit};},async detail(kind,id){return {disposition_id:id,action:'restock',history:[]};},async receipt(){return {receipt_no:'Fixture',items:[]};},async authorizations(){return []}};
  const service=Object.fromEntries(['requestAdjustment','requestReturn','requestDisposition','decideAdjustment','decideReturn','decideDisposition','receiveReturn'].map(name=>[name,async(...args)=>{calls.push({name,args});return {adjustment_id:5,return_id:6};}]));
  const app=express();app.use(express.json());app.use(cookieParser());app.use(createWorkflowsRouter({config,sessions,authRepository:{async findById(id){return users.find(u=>u.user_id===id);}},repository,service,enabled,restockingEnabled}));app.use(errorHandler);
  const server=await listenForFetch(app);t.after(()=>new Promise(r=>server.close(r)));
  return {users,calls,service,repository,async request(path,{role=1,method='GET',body,origin=config.origin}={}){const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{...(role?{Cookie:cookies[role-1]}:{}),Origin:origin,'X-TGP-Request':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};}};
}
test('workflow gates require authentication, default off and return controlled unavailable without touching schema',async t=>{
  const f=await fixture(t,{enabled:false});assert.equal((await f.request('/capabilities',{role:0})).status,401);
  assert.equal((await f.request('/capabilities')).body.data.enabled,false);assert.equal((await f.request('/adjustments',{method:'POST',body:{}})).status,503);assert.deepEqual(f.calls,[]);
});
test('enabled flag with missing/stale schema remains unavailable and safe',async t=>{
  const f=await fixture(t,{ready:false});assert.equal((await f.request('/capabilities')).body.data.enabled,false);assert.equal((await f.request('/returns')).status,503);
});
test('workflow HTTP validation binds actor, forbids injected approval and enforces roles/current status/CSRF',async t=>{
  const f=await fixture(t),input={batch_id:1,quantity:-1,reason:'Fixture recount',request_key:randomUUID()};
  assert.equal((await f.request('/adjustments',{method:'POST',body:input})).status,201);
  assert.equal(f.calls.find(c=>c.name==='requestAdjustment').args[0],1);
  for(const body of [{...input,adjusted_by:3},{...input,quantity:0},{...input,reason:' '},{...input,approved_by:3}])assert.equal((await f.request('/adjustments',{method:'POST',body})).status,400);
  assert.equal((await f.request('/adjustments/5/decision',{method:'POST',body:{decision:'approved'}})).status,403);
  assert.equal((await f.request('/dispositions')).status,403);
  assert.equal((await f.request('/adjustments',{method:'POST',body:input,origin:'https://untrusted.invalid'})).status,403);
  f.users[0].status='inactive';assert.equal((await f.request('/returns')).status,401);
});
test('decisions require rejection reasons; receipt has no quantity override; restock remains independently gated',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/returns/6/decision',{role:2,method:'POST',body:{decision:'rejected'}})).status,400);
  assert.equal((await f.request('/returns/not-an-id/decision',{role:2,method:'POST',body:{}})).status,400);
  assert.equal((await f.request('/returns/6/decision',{role:2,method:'POST',body:{decision:'rejected',reason:'Fixture rejection'}})).status,200);
  assert.equal((await f.request('/returns/6/receive',{method:'POST',body:{quantity:2}})).status,400);
  assert.equal((await f.request('/returns/6/receive',{method:'POST',body:{}})).status,200);
  assert.equal((await f.request('/dispositions/5/decision',{role:3,method:'POST',body:{decision:'approved',authorization_id:40,restock_eligible:true,assessment:'Verified storage and integrity'}})).status,503);
  assert.equal((await f.request('/returns?status=rejected&page=1&limit=20',{role:2})).status,200);
});
test('workflow unavailable/conflict responses never expose raw SQL or acknowledge uncertain success',async t=>{
  const f=await fixture(t);f.service.requestReturn=async()=>{throw Object.assign(Error('private SQL failure'),{code:'42P01'});};
  const r=await f.request('/returns',{method:'POST',body:{sale_id:1,sale_item_id:2,quantity:1,reason:'Fixture',request_key:randomUUID()}});assert.equal(r.status,503);assert(!JSON.stringify(r.body).includes('private SQL'));
});
