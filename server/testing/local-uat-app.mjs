// Child entry point used only by batch4-uat.mjs. Refuses any nonlocal target.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {verifyDisposableClient,disposableConfig} from '../test/support/disposable-database.js';
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
const url=new URL(process.env.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(Number(url.port),manifest.databasePort);
assert.equal(url.pathname,'/'+manifest.database);assert.equal(process.env.PGOPTIONS,'-c search_path='+manifest.schema);
const {getPool,closePool}=await import('../src/config/database.js');
const c=await getPool().connect();
try{
  const approved=disposableConfig(process.env,'postgres://blocked:synthetic@production.invalid/never_connect');
  await verifyDisposableClient(c,approved);
  assert.equal((await c.query('SELECT current_schema() AS schema')).rows[0].schema,manifest.schema);
}finally{c.release();}
const {createWorkflowsRepository}=await import('../src/repositories/workflows.repository.js');
assert.equal(await createWorkflowsRepository(getPool).schemaReady(),true,'UAT workflow schema is unavailable');
const {default:defaultApp,createApplication}=await import('../src/app.js');
let app=defaultApp;
if(manifest.benefits===true){
 const {verifiedLocalBenefits}=await import('./local-benefit-runtime.mjs');
 const benefits=await verifiedLocalBenefits(getPool,process.env,process.env.JWT_SECRET);
 app=createApplication({benefits});
}
const server=app.listen(manifest.apiPort,'127.0.0.1',()=>console.log('UAT API ready on loopback; local database and schema verified.'));
process.on('SIGTERM',()=>server.close(async()=>{await closePool();process.exit(0);}));
