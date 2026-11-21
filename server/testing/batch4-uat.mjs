// Owner-authorized local UAT. All generated records/credentials/artifacts stay
// in the previously attested disposable environment. Never uses the Neon pool.
import {readFile,writeFile,mkdir,realpath,readdir} from 'node:fs/promises';
import {join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {freeHttpPort} from './local-http.mjs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {disposableConfig,verifyDisposableClient} from '../test/support/disposable-database.js';
import {hashPassword} from '../src/services/passwords.js';
import {withProductionFrontend} from './local-demo.mjs';
import {seedBenefits} from '../test/support/benefit-fixture.js';
const root=await realpath(process.argv[2]),temporary=await realpath(tmpdir());
const options=process.argv.slice(3);assert(options.every(option=>['--review','--built-client','--benefits'].includes(option)),'Unsupported local UAT option');
const benefits=options.includes('--benefits');
const builtClient=options.includes('--built-client');
assert(root.startsWith(temporary+sep)&&root.slice(temporary.length+1).startsWith('tgp-pg-'));
const local=JSON.parse(await readFile(join(root,'private.json'),'utf8'));
assert(local.host==='127.0.0.1'&&local.port!==5432&&local.database.startsWith('tgp_disposable_'));
const url=new URL('postgresql://127.0.0.1');url.port=String(local.port);url.username=local.testUser;url.password=local.testPassword;url.pathname='/'+local.database;
const settings={TEST_DATABASE_URL:url.toString(),TEST_DATABASE_DISPOSABLE:'true',TEST_DATABASE_EXPECTED_HOST:'127.0.0.1',TEST_DATABASE_EXPECTED_NAME:local.database,TEST_DATABASE_ATTESTATION:local.attestation};
const approved=disposableConfig(settings,'postgres://blocked:synthetic@production.invalid/never_connect');
const c=new pg.Client({...approved.config,ssl:{rejectUnauthorized:true,ca:await readFile(join(root,'tls','ca.crt'),'utf8')}});
await c.connect();
await verifyDisposableClient(c,approved);
await c.query('BEGIN READ ONLY');
const baseline=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql'];
const history=(await c.query('SELECT version,checksum FROM public.tgp_schema_migrations ORDER BY version')).rows;
assert.equal(history.length,baseline.length);
for(let i=0;i<baseline.length;i++)assert.deepEqual(history[i],{version:baseline[i].split('/').at(-1),checksum:createHash('sha256').update(await readFile(new URL('../database/migrations/'+baseline[i],import.meta.url))).digest('hex')});
await c.query('ROLLBACK');
const schema='tgp_uat_'+randomUUID().replaceAll('-',''),runDir=join(root,schema);await mkdir(runDir);await mkdir(join(runDir,'screenshots'));
const users=[['employee',101,'employee'],['manager',102,'manager'],['admin',103,'admin'],['pharmacist',104,'manager'],['verifier',105,'admin']].map(([label,id,role])=>({label,id,role,username:'uat_'+label,password:randomBytes(24).toString('hex')}));
const manifest={schema,runDir,database:local.database,databasePort:local.port,users,benefits,apiPort:await freePort(),frontendPort:await freePort(),jwt:randomBytes(48).toString('hex'),migrationVersions:[],migrationChecksums:{}};
const manifestPath=join(runDir,'private-uat.json');
await writeFile(manifestPath,JSON.stringify(manifest));
try{
  await c.query('BEGIN');await c.query('CREATE SCHEMA '+schema);await c.query('SET LOCAL search_path TO '+schema);
  await c.query('CREATE TABLE tgp_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for(const [i,file]of [...baseline,'proposed/003_return_sale_item_link.sql','proposed/batch1/007_decision_workflows.sql','proposed/batch1/008_return_dispositions.sql','proposed/batch1/009_discount_financial_snapshots.sql',...(benefits?['proposed/batch10/011_local_benefit_checkout.sql']:[])].entries()){
    const bytes=await readFile(new URL('../database/migrations/'+file,import.meta.url));let sql=bytes.toString().replace(/--[^\n]*/g,'').trim();
    if(i){assert(sql.startsWith('BEGIN;')&&sql.endsWith('COMMIT;'));sql=sql.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');}
    assert(!/\bpublic\s*\./i.test(sql));await c.query(sql);
    const version=file.split('/').at(-1),checksum=createHash('sha256').update(bytes).digest('hex');await c.query('INSERT INTO tgp_schema_migrations(version,checksum) VALUES($1,$2)',[version,checksum]);manifest.migrationVersions.push(version);manifest.migrationChecksums[version]=checksum;
  }
  for(const u of users)await c.query('INSERT INTO users(user_id,username,password_hash,full_name,role,status) VALUES($1,$2,$3,$4,$5,\'active\')',[u.id,u.username,await hashPassword(u.password),'SYNTHETIC UAT '+u.label,u.role]);
  await c.query(`INSERT INTO products(product_id,name,generic_name,category,unit_price,reorder_level) VALUES
    (201,'UAT FEFO medicine','Synthetic generic','Test only',112,10),(202,'UAT threshold unset','Synthetic generic','Test only',100,NULL);
    INSERT INTO suppliers(supplier_id,name) VALUES(401,'SYNTHETIC UAT supplier');
    INSERT INTO batches(batch_id,product_id,batch_no,expiry_date,qty_on_hand,cost_price,selling_price) VALUES
    (301,201,'UAT-EARLIEST',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+10,5,50,112),
    (302,201,'UAT-LATER',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+20,55,50,112),
    (303,201,'UAT-EXPIRED',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date-1,3,50,112),
    (304,201,'UAT-TODAY',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,3,50,112),
    (305,201,'UAT-DELIVERY',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date+60,0,50,112);
    INSERT INTO stock_ins(stock_in_id,supplier_id,received_by,approved_by,delivery_ref,date_received)
    VALUES(600,401,101,103,'SYNTHETIC seed evidence',CURRENT_TIMESTAMP),(601,401,102,NULL,'UAT pending delivery',CURRENT_TIMESTAMP);
    INSERT INTO stock_in_items(item_id,stock_in_id,batch_id,quantity,unit_cost) VALUES(701,600,301,5,50),(702,600,302,55,50),(703,600,303,3,50),(704,600,304,3,50),(705,601,305,4,50);
    INSERT INTO purchase_orders(po_id,supplier_id,created_by,order_date,status) VALUES(501,401,102,CURRENT_TIMESTAMP,'pending');
    INSERT INTO purchase_order_items(po_item_id,po_id,product_id,quantity,unit_cost) VALUES(801,501,201,4,50);
    INSERT INTO pharmacist_authorizations(authorization_id,user_id,authorized_by,evidence_ref,verified_at,expires_at)
    VALUES(901,104,105,'SYNTHETIC TEST ONLY verified pharmacist fixture',CURRENT_TIMESTAMP-interval '1 hour',CURRENT_TIMESTAMP+interval '1 day');
    INSERT INTO activity_logs(log_id,user_id,action,module,logged_at) VALUES(1,102,'orders.created:501','purchase_orders',CURRENT_TIMESTAMP),(2,102,'receiving.created:601','stock_in',CURRENT_TIMESTAMP);`);
  if(benefits)await seedBenefits(c,{users:{employee:101,manager:102,admin:103,pharmacist:104},products:[211,212,213,214,215,216],batches:900});
  await c.query('COMMIT');
  // Verify the installed UAT ledger before any application activation.
  await c.query('BEGIN READ ONLY');await c.query('SET LOCAL search_path TO '+schema);
  const installed=(await c.query('SELECT version,checksum FROM tgp_schema_migrations')).rows;assert.equal(installed.length,benefits?8:7);
  for(const entry of installed)assert.equal(entry.checksum,manifest.migrationChecksums[entry.version]);
  assert.equal((await c.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema=$1 AND table_name='sales' AND column_name='financial_snapshot_version'",[schema])).rows[0].n,1);
  await c.query('ROLLBACK');
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
await writeFile(manifestPath,JSON.stringify(manifest));
const origin='http://127.0.0.1:'+manifest.frontendPort;
const childEnv={...process.env,...settings,DATABASE_URL:url.toString(),PGOPTIONS:'-c search_path='+schema,NODE_EXTRA_CA_CERTS:join(root,'tls','ca.crt'),NODE_ENV:'development',JWT_SECRET:manifest.jwt,JWT_TTL_SECONDS:'3600',CLIENT_ORIGIN:origin,PORT:String(manifest.apiPort),CONTROLLED_WORKFLOWS_ENABLED:'true',RETURN_RESTOCK_ENABLED:'true',PRODUCT_IMAGES_ENABLED:'false'};
const api=spawn(process.execPath,[fileURLToPath(new URL('./local-uat-app.mjs',import.meta.url)),manifestPath],{env:childEnv,cwd:new URL('../',import.meta.url),windowsHide:true,stdio:['ignore','pipe','pipe']});
let apiLog='';api.stdout.on('data',b=>{apiLog+=b;});api.stderr.on('data',b=>{apiLog+=b;});
const {createServer:createViteServer,build,preview}=await import(new URL('../../client/node_modules/vite/dist/node/index.js',import.meta.url));
const clientRoot=fileURLToPath(new URL('../../client/',import.meta.url)),{default:base}=await import(new URL('../../client/vite.config.js',import.meta.url));
let vite;
try{
  const proxy={'/api':'http://127.0.0.1:'+manifest.apiPort};
  if(builtClient){
    const outDir=join(runDir,'built-client');
    const service=await withProductionFrontend(async()=>{
      await build({...base,configFile:false,root:clientRoot,mode:'production',cacheDir:join(runDir,'vite-cache'),build:{outDir,emptyOutDir:false}});
      for(const name of (await readdir(join(outDir,'assets'))).filter(name=>name.endsWith('.js'))){
        const js=await readFile(join(outDir,'assets',name),'utf8');
        assert(!['react-dom-client.development','react.development','Download the React DevTools'].some(marker=>js.includes(marker)),'Frontend must contain production React, not inherited server development mode');
      }
      return preview({...base,configFile:false,root:clientRoot,mode:'production',build:{outDir},preview:{host:'127.0.0.1',port:manifest.frontendPort,strictPort:true,proxy}});
    });
    vite={close:()=>new Promise((accept,reject)=>service.httpServer.close(error=>error?reject(error):accept()))};
    manifest.frontendMode='production-bundle';
    manifest.frontendProductionChecked=true;
    manifest.frontendIndexChecksum=createHash('sha256').update(await readFile(join(outDir,'index.html'))).digest('hex');
    await writeFile(manifestPath,JSON.stringify(manifest));
  }else{
    vite=await createViteServer({...base,configFile:false,root:clientRoot,cacheDir:join(runDir,'vite-cache'),server:{host:'127.0.0.1',port:manifest.frontendPort,strictPort:true,proxy}});
    await vite.listen();
  }
  const until=Date.now()+20000;let ready=false;
  while(Date.now()<until){try{const r=await fetch('http://127.0.0.1:'+manifest.apiPort+'/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert(ready,'Local API did not start; inspect retained API log');
  console.log(JSON.stringify({uatSchema:schema,localOrigin:origin,frontendMode:manifest.frontendMode??'development',localOnly:true,tlsVerified:true,migrations:manifest.migrationVersions,flags:'local child only',runDir}));
  const {runBrowser}=await import(benefits?'./batch10-browser.mjs':'./batch4-browser.mjs');
  await runBrowser({root,manifest,origin});
  if(process.argv.slice(3).includes('--review')){
    // Explicit local hands-on review only. Default automated runs still stop.
    // Credentials stay in the private ACL-protected manifest, never stdout.
    const {createInterface}=await import('node:readline');
    const terminal=createInterface({input:process.stdin,output:process.stdout});
    console.log('Local synthetic UAT review: '+origin+'. Test credentials remain in the private-uat.json manifest in the retained run directory. Do not use production credentials. Press Enter or Ctrl+C to stop local app servers.');
    await new Promise(resolve=>{
      const finish=()=>{process.removeListener('SIGINT',finish);resolve()};
      terminal.once('line',finish);terminal.once('close',finish);process.once('SIGINT',finish);
    });
    terminal.close();
  }
}finally{await writeFile(join(runDir,'api.log'),apiLog);await vite?.close();api.kill();}
async function freePort(){return freeHttpPort();}
