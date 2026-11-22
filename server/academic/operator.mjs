// Explicit offline operator CLI. Never import from the application or image.
import {readFile,writeFile} from 'node:fs/promises';
import {generateKeyPairSync,randomBytes,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {canonical,readAcademicConfig,signManifest,refuse,requireAcademicOrigin,academicOperatorMatches} from '../src/academic/manifest.js';
import {migrationManifest,migrationPaths,verifyCanonicalSchema,schemaFingerprint} from '../src/academic/migrations.js';
import {academicPool} from '../src/academic/pool.js';
import {verifiedAcademicContext} from '../src/academic/capabilities.js';
import {inspectAcademicTarget,readInspectionConfig,AcademicPreflightError,usesAcademicOwner,tlsVerified} from './preflight.mjs';
import {readManagedPostgresSnapshot,managedPostgresFingerprint} from '../src/academic/managed-postgres.js';
const id=s=>{if(!/^[a-z][a-z0-9_]*$/.test(s))refuse();return '"'+s+'"';};
const literal=s=>"'"+s.replaceAll("'","''")+"'";
export async function installFresh(client){
 const manifest=await migrationManifest();
 await client.query('BEGIN');
 try{
  await client.query("SET LOCAL lock_timeout='5s'");await client.query('SELECT pg_advisory_xact_lock(742901,93)');
  const count=(await client.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN('r','p','S','v','m','f') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')")).rows[0].n;
  if(count!==0)refuse();
  await client.query('SET LOCAL search_path=public');
  await client.query('CREATE TABLE tgp_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
  for(const[i,path]of migrationPaths.entries()){
   let sql=(await readFile(new URL('../database/migrations/'+path,import.meta.url),'utf8')).replace(/--[^\n]*/g,'').trim();
   if(i){if(!sql.startsWith('BEGIN;')||!sql.endsWith('COMMIT;'))refuse();sql=sql.slice(6,-7);}
   await client.query(sql);await client.query('INSERT INTO tgp_schema_migrations(version,checksum) VALUES($1,$2)',[manifest.entries[i].version,manifest.entries[i].checksum]);
  }
  await verifyCanonicalSchema(client);await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function protectAndGrant(c,p){
 const role=id(p.role),db=id(p.database);
 const r=(await c.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolreplication,EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS member_of_role FROM pg_roles r WHERE rolname=$1',[p.role])).rows[0];
 if(!r||Object.values(r).some(Boolean)||(await c.query('SELECT pg_has_role($1,datdba,\'MEMBER\') AS owner FROM pg_database WHERE datname=$2',[p.role,p.database])).rows[0]?.owner)refuse();
 await c.query('REVOKE CREATE,TEMPORARY ON DATABASE '+db+' FROM PUBLIC');await c.query('REVOKE TEMPORARY ON DATABASE '+db+' FROM '+role);await c.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');await c.query('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC');
 await c.query('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM '+role);await c.query('REVOKE CREATE ON DATABASE '+db+' FROM '+role);await c.query('REVOKE CONNECT ON DATABASE '+db+' FROM PUBLIC');
 await c.query('GRANT CONNECT ON DATABASE '+db+' TO '+role);await c.query('GRANT USAGE ON SCHEMA public TO '+role);await c.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO '+role);
 const mutable=['users','products','batches','suppliers','purchase_orders','purchase_order_items','stock_ins','stock_in_items','stock_adjustments','sale_returns','return_dispositions','product_exchanges','admin_notification_preferences'];
 for(const t of mutable)await c.query('GRANT INSERT,UPDATE ON '+id(t)+' TO '+role);
 for(const t of ['sales','sale_items','payments','activity_logs','benefit_verifications','sale_pricing_lines','benefit_prescription_fills','exchange_claims','exchange_pricing_lines','exchange_items','exchange_settlements','exchange_events'])await c.query('GRANT INSERT ON '+id(t)+' TO '+role);
 // PostgreSQL row locks require UPDATE privilege on at least one column.
 // Grant only immutable IDs; policy triggers retain immutability. The two
 // baseline evidence tables get an academic-only owner-controlled guard.
 for(const[t,column]of [['sales','sale_id'],['sale_items','sale_item_id'],['benefit_policies','policy_id'],['benefit_product_versions','version_id'],['benefit_verifications','verification_id'],['discounts','discount_id'],['pharmacist_authorizations','authorization_id']])await c.query('GRANT UPDATE('+id(column)+') ON '+id(t)+' TO '+role);
 await c.query("CREATE FUNCTION academic_runtime_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_user=TG_ARGV[0] THEN RAISE EXCEPTION 'Academic evidence is operator-only'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$");
 for(const table of ['discounts','pharmacist_authorizations'])await c.query('CREATE TRIGGER academic_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON '+id(table)+' FOR EACH ROW EXECUTE FUNCTION academic_runtime_evidence_guard('+literal(p.role)+')');
}
export async function runOperator(action,file,{inspect=inspectAcademicTarget}={}){
 if(!['prepare','inspect','review-managed-postgres','init','seed','recover-seed','verify'].includes(action)||!file)refuse();
 const privateFile=resolve(file);
 execFileSync('git',['check-ignore','--quiet',privateFile],{stdio:'ignore',windowsHide:true});
 if(action==='prepare'){
  const keys=generateKeyPairSync('ed25519');
  const template={target:{projectId:'REPLACE',hosts:[],database:'tgp_demo_academic_web',role:'demo_runtime_academic',schema:'public',schemaDigest:'0'.repeat(64)},operatorUrl:'',runtimeUrl:'',origin:'',issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+2*86400000).toISOString(),demoId:randomUUID(),seedId:randomUUID(),jwtSecret:randomBytes(48).toString('hex'),privateKeyPem:keys.privateKey.export({type:'pkcs8',format:'pem'}),publicKeyB64:Buffer.from(keys.publicKey.export({type:'spki',format:'pem'})).toString('base64'),passwords:Object.fromEntries(['employee','manager','admin','pharmacist','verifier'].map(n=>[n,randomBytes(24).toString('hex')]))};
  await writeFile(privateFile,JSON.stringify(template,null,2),{flag:'wx',mode:0o600});return {prepared:true,credentialsPrinted:false};
 }
 const input=JSON.parse(await readFile(privateFile,'utf8')),manifest=await migrationManifest();
 if(action==='inspect')return inspect(readInspectionConfig(input),input);
 if(action==='review-managed-postgres'){
  const snapshot=await readManagedPostgresSnapshot(readInspectionConfig(input));
  return {managedPostgresDigest:managedPostgresFingerprint(snapshot),readOnly:true};
 }
 // No setup/ready signature or write-capable path without a valid HTTPS origin.
 requireAcademicOrigin(input.origin);
 let ownerSetup=false;
 if(action==='init'||action==='seed'||action==='recover-seed'){
  ownerSetup=usesAcademicOwner(input.target,input);
  if(!ownerSetup&&!academicOperatorMatches(input.target?.role,decodeURIComponent(new URL(input.operatorUrl).username)))refuse();
 }
 if(action==='recover-seed'&&(!ownerSetup||!input.target.managedPostgresDigest))refuse();
 const policy={testOnly:true,version:'synthetic-cloud-exchange-v1',validUntil:input.expiresAt,pairs:[[201,201],[201,221],[221,221]].map(([sourceProductId,replacementProductId])=>({sourceProductId,replacementProductId,authorizationId:901,prescriptionRequired:false,evidence:'SYNTHETIC TEST ONLY replacement pair',version:'synthetic-cloud-pair-v1',validUntil:input.expiresAt}))};
 const payload={protocol:'tgp-academic-cloud-v1',phase:action==='verify'?'ready':'setup',...input.target,issuedAt:input.issuedAt,expiresAt:input.expiresAt,demoId:input.demoId,seedId:input.seedId,migrationDigest:manifest.digest,exchangePolicy:policy};
 const doc=signManifest(payload,input.privateKeyPem);
 const settings={ACADEMIC_DEMO_ENABLED:'true',NODE_ENV:'production',ACADEMIC_DEMO_DATABASE_URL:input.runtimeUrl,ACADEMIC_DEMO_MANIFEST_B64:Buffer.from(canonical(doc)).toString('base64'),ACADEMIC_DEMO_PUBLIC_KEY_B64:input.publicKeyB64,CLIENT_ORIGIN:input.origin,JWT_SECRET:input.jwtSecret,PORT:'5000'};
 const config=readAcademicConfig(settings,Date.now(),{operatorSetup:action!=='verify'});
 if(action==='init'&&payload.managedPostgresDigest)await inspectAcademicTarget(config,input);
 if(action==='verify'){const pool=academicPool(config);try{await verifiedAcademicContext(config,pool);return {verified:true,readOnly:true};}finally{await pool.end();}}
 const operator=new URL(input.operatorUrl),target=new URL(input.runtimeUrl);
 if(!payload.hosts.includes(operator.hostname)||operator.pathname!==target.pathname||!['postgres:','postgresql:'].includes(operator.protocol)||operator.username===target.username||operator.hash||[...operator.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))||(operator.port&&operator.port!=='5432'))refuse();
 operator.search='';const c=new pg.Client({connectionString:operator.toString(),ssl:{rejectUnauthorized:true},options:'-c timezone=UTC -c search_path=public',connectionTimeoutMillis:10000,statement_timeout:10000});
 await c.connect();
 try{
  tlsVerified(c,operator.hostname);
  await c.query('BEGIN READ ONLY');const row=(await c.query("SELECT current_database() AS name,current_user AS actor,session_user AS login,pg_get_userbyid(datdba) AS database_owner,pg_has_role(current_user,datdba,'MEMBER') AS owner FROM pg_database WHERE datname=current_database()")).rows[0];await c.query('ROLLBACK');
  const operatorRole=decodeURIComponent(operator.username);
  if(row?.name!==payload.database||row.actor!==operatorRole||row.login!==operatorRole||!row.owner||(ownerSetup&&row.database_owner!=='neondb_owner'))refuse();
  if(action==='init'){
   await installFresh(c);let digest;
   await c.query('BEGIN');try{await protectAndGrant(c,payload);digest=await schemaFingerprint(c);const initialized=signManifest({...payload,schemaDigest:digest},input.privateKeyPem);await c.query('COMMENT ON DATABASE '+id(payload.database)+' IS '+literal(canonical(initialized)));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}
   await writeFile(join(dirname(privateFile),'.env.cloud-initialized'),JSON.stringify({...input,target:{...input.target,schemaDigest:digest}},null,2),{flag:'wx',mode:0o600});
   return {initialized:true,privateCheckpoint:'.env.cloud-initialized',versions:manifest.entries.map(r=>r.version)};
  }
  const comment=(await c.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()")).rows[0].marker;
  if(comment!==canonical(doc))refuse();
  const {seedFoundation,seedScenarios,reconcileAcademicData}=await import('./seed.mjs');
  if(action!=='recover-seed'){
   await c.query('BEGIN');try{await seedFoundation(c,input.passwords,input.expiresAt);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}
  }
  const pool=academicPool(config);try{
   if(action==='recover-seed'){const {recoverSeedScenarios}=await import('./seed-recovery.mjs');await recoverSeedScenarios(config,pool);}
   else {const context=await verifiedAcademicContext(config,pool);await seedScenarios(context);}
  }finally{await pool.end();}
  await reconcileAcademicData(c);
  const ready=signManifest({...payload,phase:'ready'},input.privateKeyPem);
  await c.query('BEGIN');try{const {createAuthRepository}=await import('../src/repositories/auth.repository.js');await createAuthRepository(()=>c).audit(c,105,'seed.ready:'+payload.seedId,'academic_setup');await c.query('COMMENT ON DATABASE '+id(payload.database)+' IS '+literal(canonical(ready)));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}
  const output={...settings,ACADEMIC_DEMO_MANIFEST_B64:Buffer.from(canonical(ready)).toString('base64'),CONTROLLED_WORKFLOWS_ENABLED:'false',RETURN_RESTOCK_ENABLED:'false',PRODUCT_IMAGES_ENABLED:'false'};
  await writeFile(join(dirname(privateFile),'.env.railway'),Object.entries(output).map(([k,v])=>k+'='+v).join('\n')+'\n',{flag:'wx',mode:0o600});
  return {seeded:true,privateRuntimeConfigurationWritten:true,credentialsPrinted:false};
 }finally{await c.end();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==4){console.error('Use operator.mjs prepare|inspect|review-managed-postgres|init|seed|recover-seed|verify <ignored-private.json>');process.exitCode=1;}
 else runOperator(process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r))).catch(error=>{console.error(error instanceof AcademicPreflightError?'Academic read-only preflight refused: '+error.check+'. No permissions or data changed.':'Academic operator refused or stopped. Preserve partial state; inspect privately. No automatic reset or retry.');process.exitCode=1;});
}
