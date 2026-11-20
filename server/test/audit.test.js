import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuditRouter } from '../src/routes/audit.routes.js';
import { createAuditRepository } from '../src/repositories/audit.repository.js';
import { auditQuery } from '../src/services/audit-validation.js';
import { createSessions } from '../src/services/sessions.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { notFound } from '../src/middleware/not-found.js';

// Fixture-only HTTP tests. No real pool, audit insertion, login or business records.
async function fixture(t) {
  let now = Date.now(), failed = false, writes = 0, reads = 0;
  const users = new Map([[1,{user_id:1,role:'admin',status:'active'}],[2,{user_id:2,role:'employee',status:'active'}],[3,{user_id:3,role:'manager',status:'active'}],[4,{user_id:4,role:'admin',status:'inactive'}]]);
  const rows = [
    {log_id:1,user_id:2,username:'fixture_staff',full_name:'Fixture Staff',action:'auth.login',module:'accounts',logged_at:'2026-11-20 08:00:00.123456'},
    {log_id:2,user_id:2,username:'fixture_staff',full_name:'Fixture Staff',action:'sale.paid:25',module:'POS',logged_at:'2026-11-20 08:00:00.123456'},
    {log_id:3,user_id:3,username:'fixture_manager',full_name:null,action:'batch.metadata_updated:7',module:'inventory',logged_at:'2026-11-19 23:59:59'},
    {log_id:4,user_id:3,username:'fixture_manager',full_name:null,action:'legacy text',module:'legacy',logged_at:null},
  ];
  const config = {secret:randomBytes(48).toString('hex'),ttl:60,secure:false,origin:'http://localhost:5173'};
  const sessions = createSessions(config,()=>now);
  const authRepository = {findById:async id=>users.get(id),audit:async()=>{writes++;throw new Error('Read must not write audit');},transaction:async()=>{writes++;throw new Error('Read must not start write workflow');}};
  const repository = {list:async({q,module,page,limit})=>{
    reads++; if(failed)throw new Error('Private storage failure');
    const filtered=rows.filter(row=>(!module||row.module===module)&&[row.username,row.full_name,row.action,row.module].some(value=>(value||'').toLowerCase().includes(q.toLowerCase())));
    filtered.sort((a,b)=>a.logged_at===null?1:b.logged_at===null?-1:b.logged_at.localeCompare(a.logged_at)||b.log_id-a.log_id);
    return {total:filtered.length,page,limit,modules:[...new Set(rows.map(row=>row.module))].sort(),data:filtered.slice((page-1)*limit,page*limit).map(row=>({...row,password_hash:'private-fixture',token:'private-fixture'})),password_hash:'private-fixture'};
  }};
  const app=express();app.use(express.json());app.use(cookieParser());
  app.use('/api/audit-logs',createAuditRouter({config,sessions,authRepository,repository}));app.use(notFound);app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  const cookie=id=>'tgp_session='+sessions.issue(id).token;
  async function request(path='',token,method='GET') {
    const response=await fetch(url+'/api/audit-logs'+path,{method,headers:token?{Cookie:token}:{}});
    return {status:response.status,cache:response.headers.get('cache-control'),body:await response.json()};
  }
  return {request,cookie,users,rows,expire:()=>{now+=61000;},fail:value=>{failed=value;},writes:()=>writes,reads:()=>reads};
}
test('audit reads reject anonymous, Employee, Manager and inactive Admin without accessing audit records',async t=>{
  const f=await fixture(t);
  for(const id of [undefined,2,3,4])assert.equal((await f.request('',id?f.cookie(id):undefined)).status,!id||id===4?401:403);
  assert.equal(f.reads(),0);assert.equal(f.writes(),0);
});
test('Admin audit search/module/pagination returns public stored fields and leaves records unchanged',async t=>{
  const f=await fixture(t),token=f.cookie(1),before=structuredClone(f.rows);
  const first=await f.request('?limit=2',token);
  assert.equal(first.status,200);assert.equal(first.cache,'no-store');
  assert.deepEqual(Object.keys(first.body).sort(),['data','limit','modules','page','success','total']);
  assert.deepEqual(first.body.data.map(row=>row.log_id),[2,1]);assert.equal(first.body.total,4);
  for(const row of first.body.data)assert.deepEqual(Object.keys(row).sort(),['action','full_name','log_id','logged_at','module','user_id','username']);
  const second=await f.request('?page=2&limit=2',token);assert.deepEqual(second.body.data.map(row=>row.log_id),[3,4]);
  const filtered=await f.request('?q=FIXTURE&module=POS',token);assert.equal(filtered.body.total,1);assert.equal(filtered.body.data[0].action,'sale.paid:25');
  assert.deepEqual(filtered.body.modules,['POS','accounts','inventory','legacy']);
  assert.deepEqual(f.rows,before);assert.equal(f.writes(),0);
});
test('audit reads support honest empty results and reject malformed or unsupported filters',async t=>{
  const f=await fixture(t),token=f.cookie(1);
  const empty=await f.request('?q=%27%20OR%201%3D1--',token);assert.equal(empty.status,200);assert.equal(empty.body.total,0);assert.deepEqual(empty.body.data,[]);
  for(const query of ['limit=0','limit=101','page=0','page=1000000','q=a&q=b','module=POS&module=accounts','q='+'a'.repeat(201),'module='+'a'.repeat(201),'export=true','role=admin','from=2026-01-01'])assert.equal((await f.request('?'+query,token)).status,400);
  assert.equal(f.writes(),0);
});
test('audit access rechecks current Admin role/status and rejects expired sessions',async t=>{
  const f=await fixture(t),token=f.cookie(1);
  f.users.get(1).role='manager';assert.equal((await f.request('',token)).status,403);
  f.users.get(1).role='admin';f.users.get(1).status='inactive';assert.equal((await f.request('',token)).status,401);
  f.users.get(1).status='active';assert.equal((await f.request('',token)).status,401);
  const next=f.cookie(1);f.expire();assert.equal((await f.request('',next)).status,401);
});
test('audit failures return safe errors; editing/deletion/export endpoints do not exist',async t=>{
  const f=await fixture(t),token=f.cookie(1);
  f.fail(true);const result=await f.request('',token);assert.equal(result.status,500);assert.equal(result.body.message,'Internal server error');
  f.fail(false);
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await f.request('',token,method)).status,404);
  assert.equal((await f.request('/export',token)).status,404);assert.equal(f.writes(),0);
});
test('audit SQL parameterizes literal search/module, orders native timestamps, and has no mutation or private projection',async()=>{
  let call;
  const repository=createAuditRepository(()=>({query:async(sql,values)=>{call={sql,values};return {rows:[{data:[],total:0,modules:[]}]};}}));
  const q="%' OR 1=1--",module="accounts' OR 1=1--";
  const result=await repository.list({q,module,page:3,limit:20});
  assert.deepEqual(call.values,[q,module,20,40]);assert(!call.sql.includes(q));assert(!call.sql.includes(module));
  assert.match(call.sql,/l\.module=\$2/);assert.match(call.sql,/ORDER BY r\.logged_at DESC NULLS LAST,r\.log_id DESC/);
  assert.match(call.sql,/LEFT JOIN users u ON u\.user_id=l\.user_id/);
  assert(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/.test(call.sql));assert(!/password_hash|token|secret/.test(call.sql));
  assert.deepEqual(result,{total:0,data:[],modules:[],page:3,limit:20});
  assert.deepEqual(auditQuery.parse({}),{q:'',module:'',page:1,limit:20});
});
