// Isolated in-memory SQL/TLS doubles. No network, private files or real secrets.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import pg from 'pg';
import {academicFixture} from './support/academic-fixture.js';
import {readAcademicConfig,canonical} from '../src/academic/manifest.js';
import {inspectAcademicTarget,readInspectionConfig,AcademicPreflightError} from '../academic/preflight.mjs';
import {verifyAcademicClient,verifiedAcademicContext,requireAcademic} from '../src/academic/capabilities.js';
import {runOperator} from '../academic/operator.mjs';

async function fixture(role='tgp_academic_runtime_sql'){
 const f=await academicFixture('setup'),payload={...f.payload,role,database:'tgp_demo_academic_web'};
 const settings=f.settingsFor(payload),config=readAcademicConfig(settings,Date.now(),{operatorSetup:true});
 const input={operatorUrl:'postgresql://tgp_academic_operator:synthetic@'+payload.hosts[0]+'/'+payload.database};
 const common={database:payload.database,schema:'public',timezone:'UTC',read_only:'on',database_comment:null,
  rolcanlogin:true,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolbypassrls:false,rolreplication:false,
  owns_database:false,usable_owner:false,owns_schema:false,member_of_role:false,owns_any_database:false,
  can_connect:true,can_create_schema:false,can_create_temp:false,can_use_schema:true,can_create:false,other_database_connect:false};
 const rows=[{...common,role:'tgp_academic_operator',session_role:'tgp_academic_operator',owns_database:true,usable_owner:true,owns_schema:true,can_create_schema:true,can_create:true},
  {...common,role:payload.role,session_role:payload.role}];
 const objects=Object.fromEntries(['relations','routines','types','extra_schemas','extra_extensions','event_triggers','publications','operators','collations','conversions','text_configs','text_dictionaries','text_parsers','text_templates'].map(k=>[k,0]));
 const calls=[],options=[],clients=[];
 const createClient=opts=>{
  const index=clients.length;options.push(opts);
  const client={ended:false,connection:{stream:{encrypted:true,authorized:true,getPeerCertificate:()=>({subjectaltname:'DNS:'+payload.hosts[0]})}},
   async connect(){calls.push({index,sql:'CONNECT'});},async end(){this.ended=true;},
   async query(sql){calls.push({index,sql});if(sql.includes('/* academic empty preflight identity */'))return {rows:[rows[index]]};if(sql.includes('/* academic empty preflight objects */'))return {rows:[objects]};if(['BEGIN READ ONLY','ROLLBACK'].includes(sql))return {rows:[]};throw Error('Unexpected SQL');}};
  clients.push(client);return client;
 };
 return {f,payload,settings,config,input,rows,objects,calls,options,clients,createClient};
}

test('approved exact runtime name works only when signed role and URL match; broad tgp roles stay rejected',async()=>{
 const x=await fixture();assert.equal(x.config.document.payload.role,'tgp_academic_runtime_sql');
 for(const role of ['tgp_academic_operator','tgp_academic_runtime_other','tgp_academic_runtime_sql_extra','TGP_academic_runtime_sql','tgp_runtime','neondb_owner']){
  assert.throws(()=>readAcademicConfig(x.f.settingsFor({...x.payload,role}),Date.now(),{operatorSetup:true}),/REFUSED/);
 }
 assert.throws(()=>readAcademicConfig({...x.settings,ACADEMIC_DEMO_DATABASE_URL:x.settings.ACADEMIC_DEMO_DATABASE_URL.replace(x.payload.role,'demo_runtime_other')},Date.now(),{operatorSetup:true}),/REFUSED/);
 const document=JSON.parse(Buffer.from(x.settings.ACADEMIC_DEMO_MANIFEST_B64,'base64'));document.payload.role='demo_runtime_other';
 assert.throws(()=>readAcademicConfig({...x.settings,ACADEMIC_DEMO_MANIFEST_B64:Buffer.from(canonical(document)).toString('base64')},Date.now(),{operatorSetup:true}),/REFUSED/);
 const runtime=await academicFixture();runtime.identity.rolreplication=true;await assert.rejects(verifyAcademicClient(runtime.client,runtime.config),/REFUSED/);
});

test('empty-target inspect verifies both TLS/SQL identities and always rolls back without writes',async()=>{
 const x=await fixture();assert.deepEqual(await inspectAcademicTarget(x.config,x.input,x),{targetVerified:true,readOnly:true,operatorVerified:true,runtimeVerified:true,emptyDatabase:true,runtimeRoleIsolation:true,changesApplied:false});
 assert.equal(x.clients.length,2);assert(x.clients.every(c=>c.ended));
 for(const o of x.options){assert.equal(o.ssl.rejectUnauthorized,true);assert.equal(o.enableChannelBinding,true);assert.match(o.options,/timezone=UTC/);assert.match(o.options,/search_path=public/);}
 assert(x.calls.every(c=>/^(CONNECT|BEGIN READ ONLY|ROLLBACK|SELECT|WITH)/.test(c.sql)));
 assert.equal(x.calls.filter(c=>c.sql==='ROLLBACK').length,2);
});

test('preflight refuses wrong endpoints or shared operator/runtime credentials before connecting',async t=>{
 for(const [name,change]of [
  ['wrong host',x=>{x.input.operatorUrl=x.input.operatorUrl.replace('ep-synthetic','ep-other');}],
  ['wrong database',x=>{x.input.operatorUrl=x.input.operatorUrl.replace(x.payload.database,'neondb');}],
  ['runtime as operator',x=>{x.input.operatorUrl=x.input.operatorUrl.replace('tgp_academic_operator',x.payload.role);}],
  ['unexpected owner as operator',x=>{x.input.operatorUrl=x.input.operatorUrl.replace('tgp_academic_operator','neondb_owner');}],
  ['redirecting options',x=>{x.input.operatorUrl+='?host=other.invalid';}],
  ['missing password',x=>{x.input.operatorUrl=x.input.operatorUrl.replace(':synthetic@','@');}],
 ])await t.test(name,async()=>{const x=await fixture();change(x);await assert.rejects(inspectAcademicTarget(x.config,x.input,x),AcademicPreflightError);assert.equal(x.clients.length,0);});
});

test('preflight refuses privilege, marker, session and identity mismatches without remediation',async t=>{
 const cases=[
  [0,'database','other'],[1,'database','other'],[0,'role','neondb_owner'],[1,'role','neondb_owner'],
  [1,'session_role','tgp_academic_operator'],[1,'schema','other'],
  [0,'owns_database',false],[0,'usable_owner',false],[0,'owns_schema',false],[0,'can_create_schema',false],[0,'can_create',false],[0,'can_use_schema',false],
  [1,'rolcanlogin',false],[1,'can_connect',false],[1,'member_of_role',true],
  ...['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls','rolreplication','owns_database','owns_any_database','can_create_schema','can_create_temp','can_create','other_database_connect'].map(k=>[1,k,true]),
  [0,'database_comment','existing marker'],[1,'database_comment',''],[0,'timezone','Asia/Manila'],[1,'read_only','off']
 ];
 for(const[index,field,value]of cases)await t.test(index+':'+field,async()=>{
  const x=await fixture();x.rows[index][field]=value;
  await assert.rejects(inspectAcademicTarget(x.config,x.input,x),AcademicPreflightError);
  assert(x.clients.every(c=>c.ended));assert.equal(x.calls.at(-1).sql,'ROLLBACK');
  assert(!x.calls.some(c=>/\b(GRANT|REVOKE|INSERT|UPDATE|DELETE|CREATE|COMMENT|ALTER|COMMIT)\b/.test(c.sql.replace(/SELECT[\s\S]*|WITH[\s\S]*/,''))));
 });
});

test('preflight rejects each unexpected object category, including empty tables and prior migration objects',async t=>{
 const template=await fixture();
 for(const field of Object.keys(template.objects))await t.test(field,async()=>{const x=await fixture();x.objects[field]=1;await assert.rejects(inspectAcademicTarget(x.config,x.input,x),e=>e.check==='unexpected_database_objects');assert.equal(x.clients.length,1);assert(x.clients[0].ended);assert.equal(x.calls.at(-1).sql,'ROLLBACK');});
});

test('preflight refuses unauthorized, unencrypted or wrong-host TLS for either actor',async t=>{
 for(const index of [0,1])for(const failure of ['encrypted','authorized','hostname'])await t.test(index+':'+failure,async()=>{
  const x=await fixture(),create=x.createClient;
  x.createClient=opts=>{const c=create(opts);if(x.clients.length-1===index){if(failure==='hostname')c.connection.stream.getPeerCertificate=()=>({subjectaltname:'DNS:wrong.invalid'});else c.connection.stream[failure]=false;}return c;};
  await assert.rejects(inspectAcademicTarget(x.config,x.input,x),AcademicPreflightError);assert(x.clients.every(c=>c.ended));
  assert(!x.calls.some(c=>c.index===index&&c.sql==='BEGIN READ ONLY'));
 });
});

test('preflight cleans up after connection/query errors and never switches target or repairs state',async()=>{
 for(const failure of ['connect','query']){const x=await fixture(),create=x.createClient;x.createClient=opts=>{const c=create(opts);c[failure]=async()=>{throw Error('SYNTHETIC transport failure');};return c;};await assert.rejects(inspectAcademicTarget(x.config,x.input,x),/SYNTHETIC/);assert.equal(x.clients.length,1);assert(x.clients[0].ended);}
});

test('importing the operator CLI does not load private application environment or seed modules',()=>{
 const source=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
 const original=fs.readFileSync;fs.readFileSync=function(path,...args){if(String(path).replaceAll('\\\\','/').endsWith('/server/.env'))throw Error('PRIVATE_ENV_READ');return original.call(this,path,...args);};syncBuiltinESMExports();
 await import('./academic/operator.mjs');if(process.env.DATABASE_URL)throw Error('UNEXPECTED_ENV');`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',env:{...process.env,TGP_RUNTIME:'',DATABASE_URL:''}});
 assert.equal(result.status,0,result.stderr);
});

function inspectionInput(x){
 const {projectId,hosts,database,role,schema,schemaDigest,issuedAt,expiresAt}=x.payload;
 return {...x.input,target:{projectId,hosts,database,role,schema,schemaDigest},issuedAt,expiresAt,runtimeUrl:x.settings.ACADEMIC_DEMO_DATABASE_URL};
}

test('origin-free inspection needs no signing/JWT material, verifies both actors and cannot authorize runtime',async()=>{
 const x=await fixture(),input=inspectionInput(x),config=readInspectionConfig(input);
 assert.equal(config.origin,undefined);assert.equal(config.secret,undefined);assert.equal(config.document.signature,undefined);
 assert.equal((await inspectAcademicTarget(config,input,x)).changesApplied,false);
 await assert.rejects(verifiedAcademicContext(config,x.f.pool),/REFUSED/);
 assert.throws(()=>readAcademicConfig({...x.settings,CLIENT_ORIGIN:''},Date.now(),{operatorSetup:true}),/REFUSED/);
});

test('origin-free inspection retains target, URL, role, host and validity checks before connecting',async t=>{
 const cases=[
  ['wrong runtime',x=>{x.runtimeUrl=x.runtimeUrl.replace('tgp_academic_runtime','neondb_owner');}],
  ['wrong database',x=>{x.runtimeUrl=x.runtimeUrl.replace('tgp_demo_academic_web','neondb');}],
  ['redirecting URL',x=>{x.runtimeUrl+='?host=other.invalid';}],
  ['wrong allowlist',x=>{x.target.hosts=['ep-other.us-east-2.aws.neon.tech'];}],
  ['non-Neon host',x=>{x.target.hosts=['localhost'];}],
  ['expired window',x=>{x.expiresAt=new Date(Date.now()-1).toISOString();}],
  ['future window',x=>{x.issuedAt=new Date(Date.now()+60000).toISOString();}],
 ];
 for(const[name,change]of cases)await t.test(name,async()=>{const x=await fixture(),input=inspectionInput(x);change(input);assert.throws(()=>readInspectionConfig(input),/REFUSED/);assert.equal(x.clients.length,0);});
});

test('actual CLI dispatch permits missing origin only for inspect; init/seed/verify refuse before signing or connection',async()=>{
 const root=resolve('tmp');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'academic-origin-')),file=join(directory,'private.json');
 const original=pg.Client.prototype.connect;let networkAttempts=0,inspections=0;
 pg.Client.prototype.connect=async()=>{networkAttempts++;throw Error('Forbidden network attempt');};
 try{
  const x=await fixture(),input=inspectionInput(x);
  await writeFile(file,JSON.stringify(input),{flag:'wx'});
  const result=await runOperator('inspect',file,{inspect:async(config,actual)=>{inspections++;return inspectAcademicTarget(config,actual,x);}});
  assert.equal(result.runtimeVerified,true);assert.equal(inspections,1);assert.equal(networkAttempts,0);
  for(const origin of [undefined,'','http://synthetic.example','https://synthetic.example/','https://synthetic.example/path']){
   await writeFile(file,JSON.stringify({...input,origin,privateKeyPem:'SYNTHETIC INVALID KEY - MUST NOT BE USED'}));
   for(const action of ['init','seed','verify'])await assert.rejects(runOperator(action,file),e=>e.message==='ACADEMIC_DEMO_REFUSED');
  }
  for(const operator of ['neondb_owner','tgp_academic_runtime','tgp_academic_runtime_sql']){
   await writeFile(file,JSON.stringify({...input,origin:'https://synthetic.example',operatorUrl:input.operatorUrl.replace('tgp_academic_operator',operator),privateKeyPem:'SYNTHETIC INVALID KEY - MUST NOT BE USED'}));
   for(const action of ['init','seed'])await assert.rejects(runOperator(action,file),e=>e.message==='ACADEMIC_DEMO_REFUSED');
  }
  assert.equal(networkAttempts,0);assert.equal(inspections,1);
 }finally{
  pg.Client.prototype.connect=original;
  if(!directory.startsWith(join(root,'academic-origin-')))throw Error('Unexpected test cleanup target');
  await rm(directory,{recursive:true});
 }
});

test('both exact academic identities retain required operator pairing; neither permits owner substitution',async t=>{
 for(const role of ['tgp_academic_runtime','tgp_academic_runtime_sql'])await t.test(role,async()=>{
  const x=await fixture(role),input=inspectionInput(x),config=readInspectionConfig(input);
  assert.equal((await inspectAcademicTarget(config,input,x)).runtimeVerified,true);
  const wrong=await fixture(role);wrong.input.operatorUrl=wrong.input.operatorUrl.replace('tgp_academic_operator','neondb_owner');
  await assert.rejects(inspectAcademicTarget(wrong.config,wrong.input,wrong),e=>e.check==='operator_role');
  assert.equal(wrong.clients.length,0);
 });
});

test('restricted SQL runtime capability binds signed identity and pool; elevated or mismatched SQL roles still fail',async()=>{
 const f=await academicFixture(),payload={...f.payload,role:'tgp_academic_runtime_sql',database:'tgp_demo_academic_web'};
 const config=readAcademicConfig(f.settingsFor(payload));
 Object.assign(f.identity,{role:payload.role,database:payload.database,attestation:canonical(config.document)});
 const context=await verifiedAcademicContext(config,f.pool);
 assert.equal(requireAcademic(context.capability,context.provider).config.document.payload.role,payload.role);
 assert.throws(()=>requireAcademic({...context.capability},context.provider),/REFUSED/);
 assert.throws(()=>requireAcademic(context.capability,()=>f.pool),/REFUSED/);
 const cases=[['role','tgp_academic_runtime'],['database','neondb'],...['member_of_role','rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls','owns_database','can_create_schema','can_create_temp','can_create','can_write_ledger'].map(k=>[k,true])];
 for(const[key,value]of cases){const old=f.identity[key];f.identity[key]=value;await assert.rejects(context.provider().connect(),/REFUSED/);f.identity[key]=old;}
});

test('explicit local owner setup is pinned to the same direct academic target',async()=>{
 const x=await fixture(),input=inspectionInput(x);
 input.setupAsDatabaseOwner=true;
 input.operatorUrl=input.operatorUrl.replace('tgp_academic_operator','neondb_owner');
 x.rows[0].role=x.rows[0].session_role='neondb_owner';
 x.rows[0].database_owner='neondb_owner';
 assert.equal((await inspectAcademicTarget(readInspectionConfig(input),input,x)).operatorVerified,true);
 x.rows[0].database_owner='cloud_admin';
 const mismatched={...x,createClient:()=>({...x.clients[0],ended:false})};
 await assert.rejects(inspectAcademicTarget(readInspectionConfig(input),input,mismatched),e=>e.check==='owner_setup_identity');
 const wrong=await fixture(),bad=inspectionInput(wrong);
 bad.setupAsDatabaseOwner=true;
 bad.operatorUrl=input.operatorUrl.replace('ep-synthetic','ep-other');
 await assert.rejects(inspectAcademicTarget(readInspectionConfig(bad),bad,wrong),AcademicPreflightError);
 assert.equal(wrong.clients.length,0);
});
