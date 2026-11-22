// Dedicated hosted synthetic runtime. No operator imports, dotenv, DDL or seed.
import {readAcademicConfig} from './academic/manifest.js';
import {academicPool} from './academic/pool.js';
import {verifiedAcademicContext} from './academic/capabilities.js';
export async function startAcademic(settings=process.env){
 const config=readAcademicConfig(settings); // Refuse before any network access.
 const pool=academicPool(config);
 try{
  const context=await verifiedAcademicContext(config,pool);
  // Satisfy legacy module initialization with safe explicit values only. All
  // academic repositories use context.provider, never the default pool.
  Object.assign(process.env,{TGP_RUNTIME:'academic-cloud',NODE_ENV:'production',JWT_SECRET:config.secret,CLIENT_ORIGIN:config.origin,PORT:String(config.port),DATABASE_URL:'postgresql://blocked:synthetic@production.invalid/never_connect',PRODUCT_IMAGES_ENABLED:'false',CONTROLLED_WORKFLOWS_ENABLED:'false',RETURN_RESTOCK_ENABLED:'false'});
  const {createAcademicApplication}=await import('./app.js');
  const app=createAcademicApplication(context);
  const server=app.listen(config.port,'0.0.0.0');
  server.on('error',()=>{console.error('Academic listener unavailable.');void pool.end();process.exitCode=1;});
  let stopping=false;
  const shutdown=()=>{if(stopping)return;stopping=true;const timeout=setTimeout(()=>process.exit(1),10000);timeout.unref();server.close(async()=>{await pool.end();clearTimeout(timeout);});};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  return {server,shutdown};
 }catch{await pool.end();throw new Error('ACADEMIC_DEMO_STARTUP_REFUSED');}
}
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){startAcademic().catch(()=>{console.error('Academic demo refused. Verify private configuration, target attestation and schema.');process.exitCode=1;});}
