import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import {listenForFetch} from '../testing/local-http.mjs';
import {createPosRouter} from '../src/routes/pos.routes.js';
import {errorHandler} from '../src/middleware/error-handler.js';
import {syntheticDraft} from './support/benefit-fixture.js';
import {verifiedLocalBenefits} from '../testing/local-benefit-runtime.mjs';
async function fixture(t,enabled=false){
 const users={1:{user_id:1,role:'employee',status:'active'},2:{user_id:2,role:'manager',status:'active'},3:{user_id:3,role:'admin',status:'active'}};
 const calls=[];const benefits=enabled?{availability:async()=>true,verification:async(_c,actor,input)=>{calls.push({actor,input});return {verification_id:crypto.randomUUID()};}}:undefined;
 const auth={findById:async id=>users[id],transaction:async work=>work({})};
 const app=express();app.use(cookieParser());app.use(express.json());app.use(createPosRouter({config:{origin:'http://localhost:5173',secure:false,secret:'synthetic-local-benefits-http-key'},sessions:{verify:id=>users[id]?{userId:Number(id),id:String(id)}:null,revoke(){}},authRepository:auth,repository:{},benefits}));app.use(errorHandler);
 const server=await listenForFetch(app);t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=async(path,{user=1,body,csrf=true}={})=>{const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(user?{Cookie:'tgp_session='+user}:{}),...(csrf?{Origin:'http://localhost:5173','X-TGP-Request':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 return {request,users,calls};
}
test('default production route composition exposes no discount activation or database writes',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/benefits/availability')).body.data.available,false);
 for(const path of ['/benefits/verify','/benefits/quote','/checkout'])assert.equal((await f.request(path,{body:{benefit:'senior'}})).status,503);
});
test('benefit verification binds active actor and retains CSRF, authentication and strict documentary validation',async t=>{
 const f=await fixture(t,true),body={items:[{product_id:1,quantity:1}],draft:syntheticDraft()};
 assert.equal((await f.request('/benefits/verify',{body,user:0})).status,401);
 assert.equal((await f.request('/benefits/verify',{body,csrf:false})).status,403);
 for(const user of [1,2,3]){assert.equal((await f.request('/benefits/verify',{user,body})).status,200);assert.equal(f.calls.at(-1).actor.user_id,user);}
 for(const invalid of [{...body,discount_id:1},{...body,draft:{...body.draft,customer:{...body.draft.customer,id:''}}},{...body,draft:{...body.draft,documents:{...body.draft.documents,identitySeen:false}}}])assert.equal((await f.request('/benefits/verify',{body:invalid})).status,400);
 f.users[1].status='inactive';assert.equal((await f.request('/benefits/verify',{body})).status,401);assert.equal(f.calls.length,3);
});
test('local activation refuses remote, default-port, unattested and production configurations before connecting',async()=>{
 let connects=0;const provider=()=>({connect:async()=>{connects++;throw Error('Must not connect');}});
 const target='postgresql://127.0.0.1:58446/tgp_disposable_synthetic';
 const base={TEST_DATABASE_URL:target,DATABASE_URL:target,NODE_ENV:'test'};
 for(const changes of [{TEST_DATABASE_URL:'postgresql://example.neon.tech:58446/tgp_disposable_synthetic'},{TEST_DATABASE_URL:'postgresql://127.0.0.1:5432/tgp_disposable_synthetic'},{DATABASE_URL:'postgresql://blocked.invalid/protected'},{NODE_ENV:'production'},{}])await assert.rejects(verifiedLocalBenefits(provider,{...base,...changes},'synthetic-key'));
 assert.equal(connects,0);
});
