import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDemoConfig, activateDemo, origin } from '../demo/config.mjs';
import { migrations } from '../demo/database.mjs';
import { addDays } from '../demo/workflows.mjs';

function fixture() {
  const input={DEMO_DATABASE_URL:'postgresql://fixture:synthetic@demo.example/tgp_demo_academic',DEMO_ISOLATION_CONFIRMED:'true',DEMO_JWT_SECRET:'synthetic-test-only-signing-key-'.repeat(3)};
  for(const role of ['ADMIN','MANAGER','EMPLOYEE']) {
    input[`DEMO_${role}_USERNAME`]='demo_'+role.toLowerCase();
    input[`DEMO_${role}_PASSWORD`]='synthetic-test-only-'+role.toLowerCase();
  }
  return input;
}
test('demo refuses missing connection or operator attestation without live fallback',()=>{
  const input=fixture();delete input.DEMO_DATABASE_URL;
  assert.throws(()=>validateDemoConfig(input),/DEMO_DATABASE_URL_REQUIRED/);
  assert.throws(()=>validateDemoConfig({...fixture(),DEMO_ISOLATION_CONFIRMED:'false'}),/ISOLATION_NOT_CONFIRMED/);
});
test('demo requires dedicated database name and refuses the protected database identity',()=>{
  for(const database of ['neondb','postgres','production','tgp_demo_'])assert.throws(()=>validateDemoConfig({...fixture(),DEMO_DATABASE_URL:'postgresql://fixture:synthetic@demo.example/'+database}),/DEDICATED_DEMO_DATABASE_NAME_REQUIRED/);
  assert.throws(()=>validateDemoConfig(fixture(),['postgresql://other:synthetic@demo-pooler.example/tgp_demo_academic']),/PROTECTED_DATABASE_REFUSED/);
  assert.equal(validateDemoConfig(fixture(),['postgresql://fixture:synthetic@live.example/neondb']).database,'tgp_demo_academic');
});
test('demo rejects URL redirection options, malformed URLs and weak/shared account configuration',()=>{
  for(const suffix of ['?host=live.example','?dbname=neondb','?options=-csearch_path=public','#fragment'])assert.throws(()=>validateDemoConfig({...fixture(),DEMO_DATABASE_URL:fixture().DEMO_DATABASE_URL+suffix}));
  assert.throws(()=>validateDemoConfig({...fixture(),DEMO_DATABASE_URL:'not a URL'}),/INVALID_DATABASE_URL/);
  assert.throws(()=>validateDemoConfig({...fixture(),DEMO_ADMIN_PASSWORD:'short'}),/INVALID_DEMO_ACCOUNT_CONFIGURATION/);
  const input=fixture();input.DEMO_EMPLOYEE_PASSWORD=input.DEMO_MANAGER_PASSWORD;
  assert.throws(()=>validateDemoConfig(input),/DISTINCT_DEMO_ACCOUNTS_REQUIRED/);
});
test('demo accepts ordinary Neon TLS parameters and normalizes pooled identity',()=>{
  const a=validateDemoConfig({...fixture(),DEMO_DATABASE_URL:fixture().DEMO_DATABASE_URL+'?sslmode=require&channel_binding=require'});
  const b=validateDemoConfig({...fixture(),DEMO_DATABASE_URL:fixture().DEMO_DATABASE_URL.replace('demo.example','demo-pooler.example')});
  assert.equal(a.fingerprint,b.fingerprint);
});
test('demo activation overrides live defaults, disables images and isolates the browser origin',t=>{
  const keys=['DATABASE_URL','JWT_SECRET','NODE_ENV','PORT','CLIENT_ORIGIN','JWT_TTL_SECONDS','PRODUCT_IMAGES_ENABLED','PGOPTIONS','TZ'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}});
  const config=validateDemoConfig(fixture());activateDemo(config);
  assert.equal(process.env.DATABASE_URL,config.values.DEMO_DATABASE_URL);
  assert.equal(process.env.PRODUCT_IMAGES_ENABLED,'false');assert.equal(process.env.PORT,'5001');
  assert.equal(process.env.CLIENT_ORIGIN,origin);assert.equal(origin,'http://127.0.0.1:5174');
  assert.equal(process.env.PGOPTIONS,'-c timezone=UTC');
});
test('demo migration allowlist preserves approved hashes and never reads deferred/image migrations',async()=>{
  const rows=await migrations();assert.deepEqual(rows.map(r=>r.version),['001_phase3_baseline.sql','002_supported_integrity.sql','004_lookup_indexes.sql']);
  assert(rows.every(r=>r.checksum.length===64 && !r.sql.includes('image_public_id')));
  assert(!rows[1].sql.trim().startsWith('BEGIN;'));assert(!rows[2].sql.trim().endsWith('COMMIT;'));
});
test('demo expiry fixtures use date-only offsets including calendar boundaries',()=>{
  assert.equal(addDays('2026-11-20',30),'2026-12-20');assert.equal(addDays('2028-02-28',1),'2028-02-29');
});
