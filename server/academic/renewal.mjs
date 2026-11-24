import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {parse} from 'dotenv';
import pg from 'pg';
import {canonical,readAcademicConfig,readManifest,signManifest,refuse} from '../src/academic/manifest.js';
import {academicPool} from '../src/academic/pool.js';
import {verifyAcademicDatabase,verifiedAcademicContext} from '../src/academic/capabilities.js';
import {verifyManagedPostgres} from '../src/academic/managed-postgres.js';
import {createAuthRepository} from '../src/repositories/auth.repository.js';
import {usesAcademicOwner,tlsVerified} from './preflight.mjs';

const origin='https://tgp-pharmacy-production.up.railway.app';
const requireCheck=condition=>{if(!condition)refuse();};
const encoded=document=>Buffer.from(canonical(document)).toString('base64');
const sourceTag=value=>typeof value==='string'&&value.startsWith('SYNTHETIC TEST ONLY');
const token=document=>createHash('sha256').update(canonical(document)).digest('hex').slice(0,24);
export function renewalState(marker,previous,replacement){
 if(replacement&&marker===canonical(replacement))return 'applied';
 requireCheck(marker===canonical(previous));
 return 'pending';
}

export function historicalSettings(settings,now=Date.now()){
 const p=JSON.parse(Buffer.from(settings.ACADEMIC_DEMO_MANIFEST_B64,'base64').toString('utf8')).payload;
 const issued=Date.parse(p.issuedAt);
 requireCheck(Number.isFinite(issued)&&issued<=now);
 const c=readAcademicConfig(settings,issued);
 requireCheck(c.origin===origin&&p.database==='tgp_demo_academic_web'&&p.role==='tgp_academic_runtime_sql'&&p.managedPostgresDigest);
 return c;
}

export function renewedPayload(previous,issuedAt,expiresAt,authorizationId){
 const start=Date.parse(issuedAt),end=Date.parse(expiresAt);
 requireCheck(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=7*86400000
  &&end>Date.parse(previous.expiresAt)&&Number.isSafeInteger(authorizationId)&&authorizationId>0&&authorizationId<=2147483647
  &&previous.exchangePolicy.pairs.every(p=>p.authorizationId!==authorizationId));
 const suffix=new Date(start).getTime();
 return {...previous,issuedAt,expiresAt,exchangePolicy:{...previous.exchangePolicy,
  version:'synthetic-cloud-renewal-'+suffix,validUntil:expiresAt,
  pairs:previous.exchangePolicy.pairs.map(p=>({...p,authorizationId,validUntil:expiresAt,version:'synthetic-cloud-pair-'+suffix}))}};
}

async function evidence(c,previous){
 const policies=(await c.query('SELECT * FROM public.benefit_policies WHERE active ORDER BY benefit_type')).rows;
 const versions=(await c.query('SELECT * FROM public.benefit_product_versions WHERE active ORDER BY benefit_type,product_id')).rows;
 const ids=[...new Set(previous.exchangePolicy.pairs.map(p=>p.authorizationId))];
 requireCheck(ids.length===1);
 const pharmacist=(await c.query('SELECT p.* FROM public.pharmacist_authorizations p JOIN public.users u ON u.user_id=p.user_id JOIN public.users a ON a.user_id=p.authorized_by WHERE p.authorization_id=$1 AND p.revoked_at IS NULL AND u.username=\'demo_pharmacist\' AND u.status=\'active\' AND u.role=\'manager\' AND a.username=\'demo_verifier\' AND a.status=\'active\' AND a.role=\'admin\'',[ids[0]])).rows[0];
 const schemes=['pwd','senior'], products=[211,212,213,215,216];
 const expires=Date.parse(previous.expiresAt);
 requireCheck(pharmacist?.user_id===104&&pharmacist.authorized_by===105&&sourceTag(pharmacist.evidence_ref)&&+new Date(pharmacist.expires_at)===expires);
 requireCheck(policies.length===2&&policies.every((p,i)=>p.benefit_type===schemes[i]&&p.reviewed_by===103&&p.test_only&&p.payload.testOnly&&sourceTag(p.payload.source)&&Date.parse(p.payload.validUntil)===expires));
 requireCheck(versions.length===10&&versions.every((v,i)=>{
  const id=products[i%5],exempt=id===212;
  return v.benefit_type===schemes[Math.floor(i/5)]&&v.product_id===id&&v.reviewed_by===103&&sourceTag(v.source)
   &&+new Date(v.valid_until)===expires&&v.eligibility===(id===213?'ineligible':'eligible')
   &&v.tax===(exempt?'vat_exempt':'vatable')&&v.price_basis===(exempt?'vat_exempt':'vat_inclusive')
   &&v.prescription_required===(id===216)&&v.promotion_state==='none';
 }));
 const idsRow=(await c.query('SELECT (SELECT max(policy_id) FROM public.benefit_policies) AS policy,(SELECT max(authorization_id) FROM public.pharmacist_authorizations) AS pharmacist')).rows[0];
 requireCheck(Number.isInteger(idsRow.policy)&&idsRow.policy<2147483645&&Number.isInteger(idsRow.pharmacist)&&idsRow.pharmacist<2147483647);
 return {policies,versions,pharmacist,policyId:idsRow.policy+1,authorizationId:idsRow.pharmacist+1};
}

export async function replaceEvidence(c,fixture,document){
 const {issuedAt,expiresAt}=document.payload,suffix=token(document);
 const versionTime=Math.max(Date.parse(issuedAt),Date.now());
 requireCheck(versionTime<Date.parse(expiresAt));
 for(const [i,p] of fixture.policies.entries()){
  requireCheck((await c.query('UPDATE public.benefit_policies SET active=false WHERE policy_id=$1 AND active',[p.policy_id])).rowCount===1);
  await c.query('INSERT INTO public.benefit_policies(policy_id,benefit_type,version,payload,reviewed_by,reviewed_at,active,test_only) VALUES($1,$2,$3,$4,$5,now(),true,true)',
   [fixture.policyId+i,p.benefit_type,'synthetic-renewal-'+suffix+'-'+p.benefit_type,{...p.payload,validUntil:expiresAt},p.reviewed_by]);
 }
 for(const v of fixture.versions){
  requireCheck((await c.query('UPDATE public.benefit_product_versions SET active=false WHERE version_id=$1 AND active',[v.version_id])).rowCount===1);
  await c.query('INSERT INTO public.benefit_product_versions(version_id,product_id,benefit_type,version,eligibility,tax,price_basis,prescription_required,promotion_state,source,reviewed_by,reviewed_at,valid_from,valid_until,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now(),$12,true)',
   [randomUUID(),v.product_id,v.benefit_type,'synthetic-renewal-'+suffix,v.eligibility,v.tax,v.price_basis,v.prescription_required,v.promotion_state,v.source,v.reviewed_by,expiresAt]);
 }
 await c.query('INSERT INTO public.pharmacist_authorizations(authorization_id,user_id,authorized_by,evidence_ref,verified_at,expires_at) VALUES($1,$2,$3,$4,now(),$5)',
  [fixture.authorizationId,fixture.pharmacist.user_id,fixture.pharmacist.authorized_by,fixture.pharmacist.evidence_ref,expiresAt]);
}

export async function renewalTransaction(owner,action,run){
 requireCheck(action==='renew-review'||action==='renew-apply');
 await owner.query(action==='renew-review'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
 try{
  if(action==='renew-apply')await owner.query('SELECT pg_advisory_xact_lock(742901,95)');
  const result=await run();
  await owner.query(action==='renew-review'?'ROLLBACK':'COMMIT');
  return result;
 }catch(error){
  await owner.query('ROLLBACK').catch(()=>{});
  throw error;
 }
}

export async function runRenewal(action,checkpoint){
 const dir=dirname(checkpoint),current=join(dir,'.env.railway'),output=join(dir,'.env.railway-renewed');
 for(const file of [checkpoint,current,output])execFileSync('git',['check-ignore','--quiet',file],{stdio:'ignore',windowsHide:true});
 const input=JSON.parse(await readFile(checkpoint,'utf8'));
 const raw=await readFile(current,'utf8'),settings=parse(raw),previous=historicalSettings(settings),p=previous.document.payload;
 requireCheck(input.origin===origin&&usesAcademicOwner(input.target,input)&&input.demoId===p.demoId&&input.seedId===p.seedId
  &&input.publicKeyB64===previous.publicKey&&new URL(input.runtimeUrl).href===previous.url
  &&Object.entries(input.target).every(([key,value])=>canonical(value)===canonical(p[key]))
  &&canonical(signManifest(p,input.privateKeyPem))===canonical(previous.document));
 let staged;
 try{staged=await readFile(output,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 let replacement;
 if(staged){
  const next=parse(staged);
  requireCheck(canonical({...next,ACADEMIC_DEMO_MANIFEST_B64:settings.ACADEMIC_DEMO_MANIFEST_B64})===canonical(settings));
  replacement=readManifest(next.ACADEMIC_DEMO_MANIFEST_B64,previous.publicKey);
  const r=replacement.payload;
  requireCheck(canonical(r)===canonical(renewedPayload(p,r.issuedAt,r.expiresAt,r.exchangePolicy.pairs[0].authorizationId)));
 }
 const operator=new URL(input.operatorUrl);operator.search='';
 const owner=new pg.Client({connectionString:operator.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true,options:'-c timezone=UTC -c search_path=public',connectionTimeoutMillis:10000,statement_timeout:15000});
 const pool=academicPool(previous);
 try{
  await owner.connect();tlsVerified(owner,operator.hostname);
  const alreadyApplied=await renewalTransaction(owner,action,async()=>{
  const db=(await owner.query("SELECT current_database() AS name,current_user AS actor,session_user AS login,pg_get_userbyid(datdba) AS owner,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()")).rows[0];
  requireCheck(db?.name===p.database&&db.actor==='neondb_owner'&&db.login===db.actor&&db.owner===db.actor);
  const already=renewalState(db.marker,previous.document,replacement)==='applied';
  requireCheck(already||Date.parse(p.expiresAt)<=Date.now());
  await verifyManagedPostgres(previous);
  const client=await pool.connect();
  try{await verifyAcademicDatabase(client,already?{...previous,document:replacement}:previous);}
  finally{client.release();}
  const fixtures=await evidence(owner,already?replacement.payload:p);
  if(already){
   const marker=(await owner.query("SELECT count(*)::int AS n FROM public.activity_logs WHERE module='academic_setup' AND user_id=105 AND action=$1",['authorization.renewed:'+token(replacement)])).rows[0];
   requireCheck(marker.n===1);
  }else if(action==='renew-apply'){
   if(!replacement){
    const issuedAt=new Date().toISOString(),expiresAt=new Date(Date.parse(issuedAt)+48*3600000).toISOString();
    replacement=signManifest(renewedPayload(p,issuedAt,expiresAt,fixtures.authorizationId),input.privateKeyPem);
    readManifest(encoded(replacement),previous.publicKey);
    staged=raw.replace(/^ACADEMIC_DEMO_MANIFEST_B64=.*$/m,'ACADEMIC_DEMO_MANIFEST_B64='+encoded(replacement));
    requireCheck(parse(staged).ACADEMIC_DEMO_MANIFEST_B64===encoded(replacement));
    await writeFile(output,staged,{flag:'wx',mode:0o600});
   }
   requireCheck(replacement.payload.exchangePolicy.pairs.every(pair=>pair.authorizationId===fixtures.authorizationId));
   await replaceEvidence(owner,fixtures,replacement);
   await evidence(owner,replacement.payload);
   await createAuthRepository(()=>owner).audit(owner,105,'authorization.renewed:'+token(replacement),'academic_setup');
   // Payload is verified and signed, yet quote it as an SQL string.
   await owner.query("COMMENT ON DATABASE tgp_demo_academic_web IS '"+canonical(replacement).replaceAll("'","''")+"'");
  }
  return Boolean(already);
  });
  if(action==='renew-apply')await verifiedAcademicContext(readAcademicConfig(parse(staged)),pool);
  return {reviewed:true,applied:action==='renew-apply',alreadyApplied,...(action==='renew-apply'?{runtimeFile:'.env.railway-renewed',verified:true}:{})};
 }
 finally{try{await owner.end();}finally{await pool.end();}}
}
