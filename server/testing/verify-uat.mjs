// Read-only final local evidence; writes only the retained UAT artifact files.
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {join,sep,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {disposableConfig,verifyDisposableClient} from '../test/support/disposable-database.js';
import {createWorkflowsRepository} from '../src/repositories/workflows.repository.js';
const root=await realpath(process.argv[2]),run=await realpath(process.argv[3]);
assert(root.startsWith((await realpath(tmpdir()))+sep)&&basename(root).startsWith('tgp-pg-')&&run.startsWith(root+sep));
const manifest=JSON.parse(await readFile(join(run,'private-uat.json'),'utf8')),local=JSON.parse(await readFile(join(root,'private.json'),'utf8'));
assert(/^tgp_uat_[a-f0-9]{32}$/.test(manifest.schema));assert.equal(local.host,'127.0.0.1');
const u=new URL('postgresql://127.0.0.1');u.port=String(local.port);u.username=local.testUser;u.password=local.testPassword;u.pathname='/'+local.database;
const settings={TEST_DATABASE_URL:u.toString(),TEST_DATABASE_DISPOSABLE:'true',TEST_DATABASE_EXPECTED_HOST:'127.0.0.1',TEST_DATABASE_EXPECTED_NAME:local.database,TEST_DATABASE_ATTESTATION:local.attestation};
const approved=disposableConfig(settings,'postgres://blocked:synthetic@production.invalid/never_connect');
const c=new pg.Client({...approved.config,ssl:{rejectUnauthorized:true,ca:await readFile(join(root,'tls','ca.crt'),'utf8')}});
await c.connect();const evidence={localOnly:true,tlsVerified:true,attestationVerified:true,port:local.port,schema:manifest.schema};
try{
  await verifyDisposableClient(c,approved);await c.query('BEGIN READ ONLY');
  const publicHistory=(await c.query('SELECT version,checksum FROM public.tgp_schema_migrations ORDER BY version')).rows;
  const files=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql'];
  assert.equal(publicHistory.length,3);
  for(let i=0;i<files.length;i++)assert.deepEqual(publicHistory[i],{version:files[i].split('/').at(-1),checksum:createHash('sha256').update(await readFile(new URL('../database/migrations/'+files[i],import.meta.url))).digest('hex')});
  const baseline=await readFile(new URL('../database/migrations/001_phase3_baseline.sql',import.meta.url),'utf8');
  for(const table of [...baseline.matchAll(/CREATE TABLE (\w+)/g)].map(m=>m[1]))assert.equal((await c.query('SELECT count(*)::int AS n FROM public.'+table)).rows[0].n,0);
  evidence.publicBaselineUnchanged=true;
  await c.query('SET LOCAL search_path TO '+manifest.schema);
  const installed=(await c.query('SELECT version,checksum FROM tgp_schema_migrations ORDER BY applied_at,version')).rows;
  const proposed=['proposed/003_return_sale_item_link.sql','proposed/batch1/007_decision_workflows.sql','proposed/batch1/008_return_dispositions.sql','proposed/batch1/009_discount_financial_snapshots.sql'];
  assert.equal(installed.length,7);
  for(const file of [...files,...proposed])assert.equal(installed.find(v=>v.version===file.split('/').at(-1))?.checksum,createHash('sha256').update(await readFile(new URL('../database/migrations/'+file,import.meta.url))).digest('hex'));
  evidence.uatMigrationChecksumsVerified=true;assert.equal(await createWorkflowsRepository(()=>c).schemaReady(),true);
  const balances=(await c.query('SELECT batch_id,qty_on_hand FROM batches ORDER BY batch_id')).rows;
  assert.deepEqual(balances.map(b=>b.qty_on_hand),[4,54,3,3,4]);evidence.batchBalances=balances;
  const sales=(await c.query('SELECT total_amount::text,approved_by FROM sales')).rows;assert.equal(sales.length,1);assert.equal(Number(sales[0].total_amount),224);assert.equal(sales[0].approved_by,null);
  const pay=(await c.query('SELECT amount_paid::text,change_due::text FROM payments')).rows;assert.equal(pay.length,1);assert.equal(Number(pay[0].amount_paid),300);assert.equal(Number(pay[0].change_due),76);
  evidence.originalCashSaleUnreversed=true;
  evidence.returns=(await c.query('SELECT decision_state,count(*)::int AS records,sum(received_quantity)::int AS received FROM sale_returns GROUP BY decision_state ORDER BY decision_state')).rows;
  assert.deepEqual(evidence.returns,[{decision_state:'approved',records:1,received:1},{decision_state:'rejected',records:1,received:0}]);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM pharmacist_authorizations WHERE authorization_id=901 AND user_id=104 AND authorized_by=105 AND evidence_ref LIKE 'SYNTHETIC TEST ONLY%'")).rows[0].n,1);
  evidence.explicitSyntheticPharmacistFixture=true;
  assert.equal((await c.query("SELECT count(*)::int AS n FROM return_dispositions WHERE decision_state='approved' AND action='restock' AND restock_eligible IS TRUE AND pharmacist_authorization_id=901")).rows[0].n,1);
  evidence.onceOnlyRestock=true;
  assert.equal((await c.query("SELECT to_regclass('admin_notification_preferences')::text AS relation")).rows[0].relation,null);
  evidence.notificationPreferencesProposalUnapplied=true;
}finally{await c.query('ROLLBACK').catch(()=>{});await c.end();}
const browser=JSON.parse(await readFile(join(run,'browser-results.json'),'utf8'));
if(browser.frontendMode==='production-bundle'){
  assert.equal(manifest.frontendProductionChecked,true);
  const html=await readFile(join(run,'built-client','index.html'));
  assert.equal(createHash('sha256').update(html).digest('hex'),manifest.frontendIndexChecksum);
  assert(!html.toString().includes('/@vite/client'));assert(html.toString().includes('/assets/'));
  evidence.builtFrontendVerified=true;
}
assert([11,13,15,17].includes(browser.steps.length));assert(browser.steps.every(s=>s.status==='passed'));assert.equal(browser.runtimeErrors.length,0);assert.equal(browser.externalRequests.length,0);assert(browser.httpErrors.every(e=>e.path==='/api/auth/me'&&e.status===401));
if(browser.steps.length>=13){
  assert(browser.steps.some(s=>s.name==='Real browser Excel/PDF downloads match displayed sale totals and Admin permissions'));
  for(const [format,signature]of [['xlsx','PK'],['pdf','%PDF']])assert.equal((await readFile(join(run,'downloads','tgp-sales.'+format))).subarray(0,signature.length).toString(),signature);
  evidence.reportDownloadsVerified=true;
}
if(browser.steps.length>=15){
  for(const name of ['Admin global audit/account review and Manager direct-route denial','Browser logout revokes copied stale cookie and re-login recovers original cashier receipt'])assert(browser.steps.some(step=>step.name===name));
  evidence.globalAuditAndAccountBrowserChecks=true;
  evidence.staleCookieAndReloginBrowserChecks=true;
}
if(browser.steps.length===17){
  for(const name of ['Within-category rankings, exact filtered Excel/PDF exports and recorded-vs-within-date stock','Admin browser-local notification preferences persist without suppressing safety alerts or changing other roles'])assert(browser.steps.some(step=>step.name===name));
  for(const [format,signature]of [['xlsx','PK'],['pdf','%PDF']])assert.equal((await readFile(join(run,'downloads','tgp-best-selling.'+format))).subarray(0,signature.length).toString(),signature);
  evidence.categoryRankExportsAndPreferencesVerified=true;
}
await writeFile(join(run,'verification.json'),JSON.stringify(evidence,null,2));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
await writeFile(join(run,'review.html'),'<!doctype html><meta charset="utf-8"><title>TGP Batch 4 local UAT evidence</title><style>body{font:16px system-ui;max-width:1200px;margin:32px auto;padding:0 20px;background:#f5f6f8;color:#202938}img{width:100%;border:1px solid #ddd}section{background:white;padding:20px;margin:20px 0}a{color:#b21f2d}</style><h1>TGP Batch 4 — local synthetic UAT evidence</h1><p>Actual Chrome '+escape(browser.browser)+' at 1440 × 1000. Eleven journeys passed. No production activation. These are synthetic local records, not clinical or fiscal compliance certification.</p><p>Database TLS, migration checksums, once-only posting and unchanged original cash payment independently verified.</p><ol>'+browser.steps.map(s=>'<li>'+escape(s.name)+' — PASSED</li>').join('')+'</ol>'+browser.screenshots.map(name=>'<section><h2>'+escape(name)+'</h2><a href="screenshots/'+escape(name)+'"><img loading="lazy" src="screenshots/'+escape(name)+'" alt="'+escape(name)+'"></a></section>').join(''));
if(browser.steps.length>=13){
  const gallery=await readFile(join(run,'review.html'),'utf8');
  await writeFile(join(run,'review.html'),gallery.replaceAll('Batch 4',browser.frontendMode==='production-bundle'?'Batch 8':browser.steps.length===17?'Batch 7':browser.steps.length===15?'Batch 6':'Batch 5').replace('Eleven journeys passed.',browser.steps.length+' journeys passed.'));
}
console.log(JSON.stringify(evidence));
