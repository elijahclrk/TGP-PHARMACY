import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,readAcademicConfig} from '../src/academic/manifest.js';
import {historicalSettings,renewedPayload,renewalState,renewalTransaction,replaceEvidence} from '../academic/renewal.mjs';
import {academicFixture} from './support/academic-fixture.js';

test('only the renewal reviewer accepts an expired, correctly signed ready document',async()=>{
 const f=await academicFixture();
 const issuedAt='2026-11-22T12:19:51.799Z',expiresAt='2026-11-24T12:19:51.799Z';
 const payload={...f.payload,issuedAt,expiresAt,database:'tgp_demo_academic_web',role:'tgp_academic_runtime_sql',managedPostgresDigest:'a'.repeat(64),
  exchangePolicy:{...f.payload.exchangePolicy,validUntil:expiresAt,pairs:f.payload.exchangePolicy.pairs.map(p=>({...p,validUntil:expiresAt}))}};
 const settings={...f.settingsFor(payload),CLIENT_ORIGIN:'https://tgp-pharmacy-production.up.railway.app'};
 const now=Date.parse(expiresAt)+1000;
 assert.throws(()=>readAcademicConfig(settings,now));
 assert.equal(historicalSettings(settings,now).document.payload.expiresAt,expiresAt);
 assert.throws(()=>historicalSettings({...settings,CLIENT_ORIGIN:'https://wrong.example'},now));
 assert.throws(()=>historicalSettings({...settings,ACADEMIC_DEMO_MANIFEST_B64:Buffer.from(canonical({...f.signed(payload),payload:{...payload,seedId:f.payload.demoId}})).toString('base64')},now));
 const start=new Date(now).toISOString(),end=new Date(now+7*86400000).toISOString();
 const next=renewedPayload(payload,start,end,902);
 assert.equal(next.seedId,payload.seedId);
 assert.equal(next.schemaDigest,payload.schemaDigest);
 assert.equal(next.exchangePolicy.pairs[0].authorizationId,902);
 assert.equal(next.exchangePolicy.pairs[0].validUntil,end);
 assert.doesNotThrow(()=>readAcademicConfig({...f.settingsFor(next),CLIENT_ORIGIN:settings.CLIENT_ORIGIN},now));
 assert.throws(()=>renewedPayload(payload,start,new Date(Date.parse(end)+1).toISOString(),902));
 assert.throws(()=>renewedPayload(payload,start,end,901));
});

test('attestation state distinguishes pending and committed retries and rejects drift',()=>{
 const old={signature:'old'},next={signature:'next'};
 assert.equal(renewalState(canonical(old),old,next),'pending');
 assert.equal(renewalState(canonical(next),old,next),'applied');
 assert.throws(()=>renewalState(canonical(next),old));
 assert.throws(()=>renewalState(canonical({signature:'other'}),old,next));
});

test('review is read-only and atomic apply rolls back before a retry',async()=>{
 const calls=[],owner={query:async sql=>{calls.push(sql);}};
 await renewalTransaction(owner,'renew-review',()=>owner.query('SELECT marker'));
 assert.deepEqual(calls.splice(0),['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY','SELECT marker','ROLLBACK']);
 await assert.rejects(renewalTransaction(owner,'renew-apply',async()=>{
  await owner.query('update evidence');
  throw Error('interrupted');
 }),/interrupted/);
 assert.deepEqual(calls.splice(0),['BEGIN','SELECT pg_advisory_xact_lock(742901,95)','update evidence','ROLLBACK']);
 await renewalTransaction(owner,'renew-apply',()=>owner.query('update evidence and marker'));
 assert.deepEqual(calls,['BEGIN','SELECT pg_advisory_xact_lock(742901,95)','update evidence and marker','COMMIT']);
});

test('renewal versions synthetic evidence while retaining historical claims and reviewer links',async()=>{
 const calls=[],owner={query:async(sql,args)=>{calls.push({sql,args});return {rowCount:1};}};
 const expiresAt=new Date(Date.now()+3600000).toISOString();
 const fixture={policyId:3,authorizationId:902,
  policies:[{policy_id:1,benefit_type:'senior',payload:{testOnly:true,discountBps:2000},reviewed_by:103}],
  versions:[{version_id:'prior-version',product_id:212,benefit_type:'senior',eligibility:'eligible',
   tax:'vat_exempt',price_basis:'vat_exempt',prescription_required:false,promotion_state:'none',source:'SYNTHETIC TEST ONLY',reviewed_by:103}],
  pharmacist:{user_id:104,authorized_by:105,evidence_ref:'SYNTHETIC TEST ONLY'}};
 await replaceEvidence(owner,fixture,{payload:{issuedAt:new Date().toISOString(),expiresAt}});
 assert.equal(calls.length,5);
 assert.deepEqual(calls[0].args,[1]);
 assert.deepEqual(calls[1].args.slice(3),[{testOnly:true,discountBps:2000,validUntil:expiresAt},103]);
 assert.deepEqual(calls[2].args,['prior-version']);
 assert.deepEqual(calls[3].args.slice(4),['eligible','vat_exempt','vat_exempt',false,'none','SYNTHETIC TEST ONLY',103,expiresAt]);
 assert.deepEqual(calls[4].args,[902,104,105,'SYNTHETIC TEST ONLY',expiresAt]);
 await assert.rejects(replaceEvidence({query:async()=>({rowCount:0})},fixture,{payload:{issuedAt:new Date().toISOString(),expiresAt}}));
});
