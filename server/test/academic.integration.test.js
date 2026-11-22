// Real SQL in a NEW disposable schema. Cloud DNS/role/attestation are explicit
// identity doubles; this is not a connection to, or certification of, Neon.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import https from 'node:https';
import {getPool,closePool} from './support/disposable-database.js';
import {installBenefits} from './support/benefit-fixture.js';
import {academicFixture} from './support/academic-fixture.js';
import {migrationPaths,migrationManifest,schemaFingerprint} from '../src/academic/migrations.js';
import {canonical,readAcademicConfig} from '../src/academic/manifest.js';
import {verifiedAcademicContext} from '../src/academic/capabilities.js';
import {seedFoundation,seedScenarios,fixtureUsers,reconcileAcademicData} from '../academic/seed.mjs';
import {createAcademicApplication} from '../src/app.js';
import {createAuthRepository} from '../src/repositories/auth.repository.js';
import {createReportsRepository} from '../src/repositories/reports.repository.js';
import {installFresh,protectAndGrant} from '../academic/operator.mjs';

test('academic full schema and services on disposable PostgreSQL; cloud identity is simulated',{skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'},async t=>{
 const schema='tgp_cloud_test_'+randomUUID().replaceAll('-',''),base=getPool(),passwords=Object.fromEntries(fixtureUsers.map(([n])=>[n,randomBytes(24).toString('hex')]));let created=false,server;
 try{
  const c=await base.connect();let digest;
  try{await c.query('BEGIN');await c.query('CREATE SCHEMA '+schema);created=true;await c.query('SET LOCAL search_path TO '+schema);await installBenefits(c,migrationPaths);await c.query('CREATE TABLE tgp_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');for(const e of (await migrationManifest()).entries)await c.query('INSERT INTO tgp_schema_migrations(version,checksum) VALUES($1,$2)',[e.version,e.checksum]);await seedFoundation(c,passwords,new Date(Date.now()+3600000).toISOString());digest=await schemaFingerprint(c);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');created=false;throw e;}finally{c.release();}
  const f=await academicFixture('setup');
  const setupPayload={...f.payload,schemaDigest:digest},settings=f.settingsFor(setupPayload),config=readAcademicConfig(settings,Date.now(),{operatorSetup:true});f.identity.attestation=canonical(config.document);
  // Only identity/certificate are doubled. All catalog, ledger, application,
  // trigger, constraint and financial queries execute against PostgreSQL.
  const pool={async connect(){const real=await base.connect();await real.query('SET search_path TO '+schema);return {connection:f.client.connection,release:()=>real.release(),query:(sql,args)=>sql.startsWith('SELECT current_database()')?f.client.query(sql,args):real.query(sql,args)};}};
  const context=await verifiedAcademicContext(config,pool);
  await t.test('all-feature operator recipe posts real reviewed/FEFO/benefit/return/exchange transactions',async()=>{await seedScenarios(context);const c=await context.provider().connect();try{assert.deepEqual(await reconcileAcademicData(c),{financial:0,stock:0,returns:0,settlement:0});}finally{c.release();}const r=await createReportsRepository(context.provider).sales({from:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}),to:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}),period:'day'});assert.equal(r.excluded_records,0);assert(r.transactions>=5);});
  const auth=createAuthRepository(context.provider);await auth.transaction(c=>auth.audit(c,105,'seed.ready:'+setupPayload.seedId,'academic_setup'));
  const readySettings=f.settingsFor({...setupPayload,phase:'ready'}),readyConfig=readAcademicConfig(readySettings);f.identity.attestation=canonical(readyConfig.document);
  const ready=await verifiedAcademicContext(readyConfig,pool);
  await t.test('schema drift refuses a new verified connection and removing test drift restores compatibility',async()=>{const c=await base.connect();try{await c.query('SET search_path TO '+schema);await c.query('ALTER TABLE products ADD COLUMN synthetic_drift integer');await assert.rejects(verifiedAcademicContext(readyConfig,pool),/REFUSED/);await c.query('ALTER TABLE products DROP COLUMN synthetic_drift');}finally{c.release();}await verifiedAcademicContext(readyConfig,pool);});
  const artifact=await mkdtemp(join(tmpdir(),'tgp-academic-https-'));
  const openssl='B:/Git/usr/bin/openssl.exe';
  execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(artifact,'private.key'),'-out',join(artifact,'certificate.crt'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{windowsHide:true,stdio:'ignore',env:{...process.env,MSYS_NO_PATHCONV:'1'}});
  const ca=await readFile(join(artifact,'certificate.crt'));
  server=https.createServer({key:await readFile(join(artifact,'private.key')),cert:ca},createAcademicApplication(ready));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  function request(path,{method='GET',headers={},body,trust=ca,servername}={}){return new Promise((resolve,reject)=>{const req=https.request({hostname:'127.0.0.1',port:server.address().port,path,method,headers,ca:trust,rejectUnauthorized:true,...(servername?{servername}:{})},res=>{const data=[];res.on('data',b=>data.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(data)}));});req.on('error',reject);if(body)req.write(body);req.end();});}
  await t.test('actual local HTTPS validates certificates, secure login cookies, CSRF and role limits',async()=>{
   await assert.rejects(request('/api/health',{trust:null}),/self.signed/i);
   await assert.rejects(request('/api/health',{servername:'wrong.invalid'}),/altname|Hostname/i);
   const login=await request('/api/auth/login',{method:'POST',headers:{Origin:readyConfig.origin,'X-TGP-Request':'1','Content-Type':'application/json'},body:JSON.stringify({username:'demo_employee',password:passwords.employee})});assert.equal(login.status,200);const cookie=login.headers['set-cookie'][0];assert.match(cookie,/__Secure-tgp_session/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
   assert.equal((await request('/api/auth/users',{headers:{Cookie:cookie.split(';')[0]}})).status,403);
   assert.equal((await request('/api/pos/quote',{method:'POST',headers:{Cookie:cookie.split(';')[0],'Content-Type':'application/json'},body:'{}'})).status,403);
  });
  await t.test('Chrome academic workflow screens over a certificate-verified TLS bridge',async()=>{
   const tools=join(dirname(dirname(process.env.NODE_EXTRA_CA_CERTS)),'browser-tools/node_modules/playwright-core/index.mjs');
   const {chromium}=await import(pathToFileURL(tools).href),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],steps=[];let browserReceipt;
   try{for(const label of ['employee','manager','admin']){const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});await ctx.route('**/*',async route=>{const r=route.request(),url=new URL(r.url());if(url.origin!==readyConfig.origin)return route.abort();const headers={...r.headers()};delete headers.host;delete headers['content-length'];const res=await request(url.pathname+url.search,{method:r.method(),headers,body:r.postDataBuffer()});const out={};for(const[k,v]of Object.entries(res.headers))if(!['connection','keep-alive','transfer-encoding','content-length'].includes(k))out[k]=Array.isArray(v)?v.join('\n'):String(v);await route.fulfill({status:res.status,headers:out,body:res.body});});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(readyConfig.origin+'/login');await page.getByText('ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS',{exact:true}).waitFor();await page.getByLabel('Username',{exact:true}).fill('demo_'+label);await page.getByLabel('Password',{exact:true}).fill(passwords[label]);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(readyConfig.origin+'/'+label);
    if(label==='employee'){
     for(const scheme of ['regular','senior','pwd']){
      await page.goto(readyConfig.origin+'/pos');
      if(scheme!=='regular'){await page.getByLabel('Customer benefit',{exact:true}).selectOption(scheme);await page.getByLabel('Beneficiary name',{exact:true}).fill('SYNTHETIC BROWSER BENEFICIARY');await page.getByLabel('Beneficiary identification number',{exact:true}).fill('SYNTHETIC-BROWSER-ID');for(const name of ['Presented identity verified','Scheme entitlement verified','Items are for beneficiary exclusive use',...(scheme==='pwd'?['PWD medicine booklet verified']:[])])await page.getByLabel(name,{exact:true}).check();}
      for(const name of scheme==='regular'?['SYNTHETIC FEFO medicine']:['SYNTHETIC benefit 1','SYNTHETIC benefit 2','SYNTHETIC benefit 3'])await page.getByRole('button',{name:'Add '+name,exact:true}).click();
      await page.getByRole('button',{name:'Review total',exact:true}).click();await page.getByText('Total: PHP '+(scheme==='regular'?'112.00':'272.00'),{exact:true}).waitFor();await page.getByLabel('Cash received (PHP)').fill('300');const next=page.waitForResponse(r=>r.url()===readyConfig.origin+'/api/pos/checkout'&&r.request().method()==='POST');await page.getByRole('button',{name:'Complete cash sale',exact:true}).click();const response=await next;assert.equal(response.status(),201);const receipt=(await response.json()).data.receipt;assert.equal(receipt.total_amount,scheme==='regular'?'112.00':'272.00');if(scheme==='regular')browserReceipt=receipt.receipt_no;else assert.equal(receipt.financial.benefit,scheme);await page.getByRole('region',{name:'Receipt',exact:true}).getByText('ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS',{exact:true}).waitFor();steps.push('employee '+scheme+' cash checkout and labeled receipt');
     }
    }
    const paths=label==='employee'?['/products','/inventory','/alerts','/pos','/returns','/adjustments']:label==='manager'?['/purchase-orders','/stock-ins','/approvals','/returns']:['/reports','/notifications','/users','/audit-logs'];
    for(const path of paths){await page.goto(readyConfig.origin+path);await page.getByRole('heading',{level:1}).waitFor();await page.getByText('ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS',{exact:true}).first().waitFor();steps.push(label+' '+path);}
    if(label==='admin'){
     await page.goto(readyConfig.origin+'/reports');await page.getByLabel('Report',{exact:true}).selectOption('transactions');await page.getByRole('button',{name:browserReceipt,exact:true}).click();await page.getByRole('region',{name:'Receipt',exact:true}).getByText('ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS',{exact:true}).waitFor();await page.getByRole('button',{name:'Close transaction',exact:true}).click();
     for(const format of ['xlsx','pdf']){const next=page.waitForEvent('download');await page.getByRole('button',{name:format==='xlsx'?'Export Excel (.xlsx)':'Export PDF',exact:true}).click();const download=await next;const path=join(artifact,'academic-transactions.'+format);await download.saveAs(path);const bytes=await readFile(path);assert.equal(bytes.subarray(0,format==='xlsx'?2:4).toString(),format==='xlsx'?'PK':'%PDF');if(format==='xlsx'){const {default:ExcelJS}=await import('exceljs');const b=new ExcelJS.Workbook();await b.xlsx.load(bytes);assert.equal(b.getWorksheet('Report').getRow(1).getCell(1).text,'ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS');}}
     steps.push('admin historical receipt and labeled Excel/PDF downloads');
    }
    await page.screenshot({path:join(artifact,label+'.png'),fullPage:true});await ctx.close();}
    assert.deepEqual(errors,[]);await writeFile(join(artifact,'browser-results.json'),JSON.stringify({bridge:'Browser requests fulfilled from actual local HTTPS using strict CA/hostname verification; not Railway ingress',steps,runtimeErrors:errors},null,2));console.log('Academic Chrome screen checks: '+steps.length+'; evidence '+artifact);
   }finally{await browser.close();}
  });
 }finally{if(server)await new Promise(r=>server.close(r));if(created){assert(/^tgp_cloud_test_[a-f0-9]{32}$/.test(schema));await base.query('DROP SCHEMA '+schema+' CASCADE');}await closePool();}
});

test('academic operator migrations and restricted runtime grants in a new local disposable database; cloud SAN simulated',{skip:process.env.RUN_WORKFLOW_DB_TESTS!=='1'},async t=>{
 const base=getPool(),check=await base.connect();check.release(); // Proven external isolation before admin access.
 const root=dirname(dirname(process.env.NODE_EXTRA_CA_CERTS)),local=JSON.parse(await readFile(join(root,'private.json'),'utf8'));
 assert.equal(local.host,'127.0.0.1');assert.notEqual(local.port,5432);
 assert.equal(new URL(process.env.TEST_DATABASE_URL).pathname,'/'+local.database);assert.equal(process.env.TEST_DATABASE_ATTESTATION,local.attestation);
 const {default:pg}=await import('pg'),ca=await readFile(join(root,'tls/ca.crt'),'utf8');
 const connection=(user,password,database)=>{const u=new URL('postgresql://127.0.0.1');u.port=String(local.port);u.username=user;u.password=password;u.pathname='/'+database;return {connectionString:u.toString(),ssl:{rejectUnauthorized:true,ca},options:'-c timezone=UTC -c search_path=public'};};
 const name=randomUUID().replaceAll('-',''),db='tgp_demo_'+name,role='demo_runtime_'+name,password=randomBytes(32).toString('hex');
 const admin=new pg.Client(connection(local.adminUser,local.adminPassword,'postgres'));let dbCreated=false,roleCreated=false,c,runtime;
 await admin.connect();try{
  assert.equal(admin.connection.stream.authorized,true);assert.equal((await admin.query('SHOW listen_addresses')).rows[0].listen_addresses,'127.0.0.1');assert.equal((await admin.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),join(root,'data').replaceAll('\\','/').toLowerCase());
  await admin.query('CREATE ROLE '+role+" LOGIN PASSWORD '"+password+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT");roleCreated=true;
  await admin.query('CREATE DATABASE '+db);dbCreated=true;c=new pg.Client(connection(local.adminUser,local.adminPassword,db));await c.connect();
  await t.test('actual empty-target migration runner applies exactly eleven checksummed versions and refuses rerun',async()=>{await installFresh(c);assert.equal((await c.query('SELECT count(*)::int AS n FROM tgp_schema_migrations')).rows[0].n,11);await assert.rejects(installFresh(c),/REFUSED/);});
  const f=await academicFixture('setup'),payload={...f.payload,database:db,role,schemaDigest:await schemaFingerprint(c)};
  await protectAndGrant(c,payload);payload.schemaDigest=await schemaFingerprint(c);
  const settings={...f.settingsFor(payload),ACADEMIC_DEMO_DATABASE_URL:f.settings.ACADEMIC_DEMO_DATABASE_URL.replace('/tgp_demo_fixture','/'+db).replace('demo_runtime_fixture:',''+role+':')};
  const config=readAcademicConfig(settings,Date.now(),{operatorSetup:true});
  await c.query('COMMENT ON DATABASE '+db+" IS '"+canonical(config.document).replaceAll("'","''")+"'");
  const passwords=Object.fromEntries(fixtureUsers.map(([label])=>[label,randomBytes(24).toString('hex')]));await c.query('BEGIN');await seedFoundation(c,passwords,payload.expiresAt);await c.query('COMMIT');
  runtime=new pg.Pool({...connection(role,password,db),max:3});
  const pool={async connect(){const actual=await runtime.connect();assert.equal(actual.connection.stream.authorized,true);return {connection:f.client.connection,release:()=>actual.release(),query:(...args)=>actual.query(...args)};}};
  await t.test('real runtime role verifies signed marker and schema, cannot alter ledger or create schema, and runs full seed services',async()=>{const context=await verifiedAcademicContext(config,pool);await assert.rejects(runtime.query('CREATE SCHEMA forbidden_schema'));await assert.rejects(runtime.query("UPDATE tgp_schema_migrations SET checksum=repeat('0',64)"));await assert.rejects(runtime.query("UPDATE benefit_policies SET active=false"));await assert.rejects(runtime.query('UPDATE pharmacist_authorizations SET authorization_id=authorization_id'));await assert.rejects(runtime.query('UPDATE discounts SET discount_id=discount_id'));await seedScenarios(context);});
  await t.test('operator-only publication enables ready context; runtime cannot change database attestation',async()=>{await createAuthRepository(()=>c).audit(c,105,'seed.ready:'+payload.seedId,'academic_setup');const readyPayload={...payload,phase:'ready'},readyConfig=readAcademicConfig({...settings,ACADEMIC_DEMO_MANIFEST_B64:Buffer.from(canonical(f.signed(readyPayload))).toString('base64')});await c.query('COMMENT ON DATABASE '+db+" IS '"+canonical(readyConfig.document).replaceAll("'","''")+"'");await assert.rejects(runtime.query('COMMENT ON DATABASE '+db+" IS 'forbidden'"));await verifiedAcademicContext(readyConfig,pool);});
 }finally{await runtime?.end();await c?.end();if(dbCreated){assert(/^tgp_demo_[a-f0-9]{32}$/.test(db));await admin.query('DROP DATABASE '+db);}if(roleCreated){assert(/^demo_runtime_[a-f0-9]{32}$/.test(role));await admin.query('DROP ROLE '+role);}await admin.end();await closePool();}
});
