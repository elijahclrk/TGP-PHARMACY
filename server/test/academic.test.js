import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {academicFixture} from './support/academic-fixture.js';
import {readAcademicConfig,canonical} from '../src/academic/manifest.js';
import {verifiedAcademicContext,verifyAcademicClient,requireAcademic} from '../src/academic/capabilities.js';
import {createLocalBenefitsRepository} from '../src/repositories/local-benefits.repository.js';
import {createAcademicApplication,createApplication} from '../src/app.js';
import {listenForFetch} from '../testing/local-http.mjs';
import {packagedWorkflowFixture} from './support/packaged-workflow-fixture.js';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';

test('academic signed config rejects wrong targets, aliases, fallback, expired and tampered authorization before connecting',async()=>{
 const f=await academicFixture();assert(readAcademicConfig(f.settings));
 for(const patch of [{DATABASE_URL:'postgresql://blocked.invalid/protected'},{TEST_DATABASE_URL:f.settings.ACADEMIC_DEMO_DATABASE_URL},{NODE_ENV:'development'},{ACADEMIC_DEMO_ENABLED:'false'},{ACADEMIC_DEMO_DATABASE_URL:f.settings.ACADEMIC_DEMO_DATABASE_URL.replace('tgp_demo_fixture','other')},{ACADEMIC_DEMO_DATABASE_URL:f.settings.ACADEMIC_DEMO_DATABASE_URL.replace('ep-synthetic','ep-other')},{ACADEMIC_DEMO_DATABASE_URL:f.settings.ACADEMIC_DEMO_DATABASE_URL.replace('demo_runtime_fixture','owner')},{ACADEMIC_DEMO_DATABASE_URL:f.settings.ACADEMIC_DEMO_DATABASE_URL+'?host=other.invalid'},{ACADEMIC_DEMO_TRUSTED_PROXY_CIDRS:'0.0.0.0/0'},{CLIENT_ORIGIN:'http://synthetic.example'},{CONTROLLED_WORKFLOWS_ENABLED:'true'}])assert.throws(()=>readAcademicConfig({...f.settings,...patch}),/REFUSED/);
 assert.throws(()=>readAcademicConfig(f.settings,Date.now()+7200000),/REFUSED/);
 const d=JSON.parse(Buffer.from(f.settings.ACADEMIC_DEMO_MANIFEST_B64,'base64'));d.payload.database='tgp_demo_changed';assert.throws(()=>readAcademicConfig({...f.settings,ACADEMIC_DEMO_MANIFEST_B64:Buffer.from(canonical(d)).toString('base64')}),/REFUSED/);
 const setup=await academicFixture('setup');assert.throws(()=>readAcademicConfig(setup.settings),/REFUSED/);
});
test('academic target inspection is read-only and rejects role/ownership/marker/schema/checksum/TLS mismatches',async()=>{
 const f=await academicFixture();await verifyAcademicClient(f.client,f.config);assert(f.calls.every(c=>/^(SELECT|BEGIN READ ONLY|ROLLBACK)/.test(c.sql)));
 for(const[field,value]of [['database','other'],['role','owner'],['schema','other'],['attestation','wrong'],['owns_database',true],['can_create',true],['can_write_ledger',true],['rolcreaterole',true],['timezone','Asia/Manila']]){const before=f.identity[field];f.identity[field]=value;await assert.rejects(verifyAcademicClient(f.client,f.config),/REFUSED/);f.identity[field]=before;}
 f.client.connection.stream.authorized=false;await assert.rejects(verifyAcademicClient(f.client,f.config),/REFUSED/);f.client.connection.stream.authorized=true;
 const query=f.client.query;f.client.query=async(sql,args)=>sql.startsWith('SELECT version,checksum')?{rows:[]}:query(sql,args);await assert.rejects(verifyAcademicClient(f.client,f.config),/REFUSED/);
});
test('opaque capability rejects forged and borrowed providers; setup cannot serve HTTP',async()=>{
 const f=await academicFixture(),ctx=await verifiedAcademicContext(f.config,f.pool);
 assert.throws(()=>createAcademicApplication({capability:{...ctx.capability},provider:ctx.provider}),/REFUSED/);
 assert.throws(()=>requireAcademic(ctx.capability,()=>f.pool),/REFUSED/);
 assert.throws(()=>createLocalBenefitsRepository({poolProvider:ctx.provider,secret:'synthetic',isolatedCapability:{kind:'cloud-academic'}}));
 const setup=await academicFixture('setup'),pending=await verifiedAcademicContext(setup.config,setup.pool);assert.throws(()=>createAcademicApplication(pending),/setup/);
 const old=process.env.NODE_ENV; // Existing factory uses immutable env; covered separately in production subprocess.
 assert(old);assert.equal(typeof createApplication,'function');
});
test('academic HTTP boundary requires HTTPS from explicitly trusted proxy and preserves anonymous RBAC and CSRF',async()=>{
 const f=await academicFixture(),ctx=await verifiedAcademicContext(f.config,f.pool),app=createAcademicApplication(ctx),server=await listenForFetch(app);
 try{const base='http://127.0.0.1:'+server.address().port;
  const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).academic_demo,true);
  assert.equal((await fetch(base+'/api/auth/me')).status,503);
  assert.equal((await fetch(base+'/api/auth/me',{headers:{'X-Forwarded-Proto':'https'}})).status,401);
  assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{'X-Forwarded-Proto':'https','Content-Type':'application/json',Origin:'https://evil.invalid','X-TGP-Request':'1'},body:'{}'})).status,403);
 }finally{await new Promise(r=>server.close(r));}
 const untrusted={...f.config,proxies:[]},u=await verifiedAcademicContext(untrusted,f.pool),s=await listenForFetch(createAcademicApplication(u));try{assert.equal((await fetch('http://127.0.0.1:'+s.address().port+'/api/auth/me',{headers:{'X-Forwarded-Proto':'https','X-Forwarded-For':'1.2.3.4'}})).status,503);}finally{await new Promise(r=>s.close(r));}
});
test('dedicated academic startup refuses missing config and normal production guards remain closed',()=>{
 const env={...process.env,NODE_ENV:'production',DATABASE_URL:'postgresql://blocked:synthetic@production.invalid/never_connect',JWT_SECRET:'synthetic-test-secret-'.repeat(4)};
 const r=spawnSync(process.execPath,['src/academic-server.js'],{env,encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/refused/);assert(!r.stderr.includes('postgresql:'));
 const p=spawnSync(process.execPath,['--input-type=module','-e',"const {createApplication}=await import('./src/app.js');try{createApplication({benefits:{}});process.exit(2)}catch{process.exit(0)}"],{env,encoding:'utf8'});assert.equal(p.status,0);
});
test('packaged runtime contains the complete canonical manifest without operator tooling',async()=>{
 const p=await packagedWorkflowFixture();try{const {migrationManifest}=await import(pathToFileURL(join(p.runtime,'src/academic/migrations.js')).href);assert.equal((await migrationManifest()).entries.length,11);}finally{await p.dispose();}
});
