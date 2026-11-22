// Synthetic signed identity double. No network or operational credentials.
import {generateKeyPairSync,randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonical,signManifest,readAcademicConfig} from '../../src/academic/manifest.js';
import {migrationManifest,migrationPaths} from '../../src/academic/migrations.js';
export async function academicFixture(phase='ready'){
 const keys=generateKeyPairSync('ed25519'),manifest=await migrationManifest(),host='ep-synthetic.us-east-2.aws.neon.tech';
 const expiresAt=new Date(Date.now()+3600000).toISOString();
 const schemaDigest=createHash('sha256').update(canonical({access:[],functions:[],columns:[],constraints:[],indexes:[],triggers:[]})).digest('hex');
 const payload={protocol:'tgp-academic-cloud-v1',phase,demoId:randomUUID(),seedId:randomUUID(),projectId:'synthetic-project',hosts:[host],database:'tgp_demo_fixture',role:'demo_runtime_fixture',schema:'public',issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt,migrationDigest:manifest.digest,schemaDigest,exchangePolicy:{testOnly:true,version:'synthetic-v1',validUntil:expiresAt,pairs:[[201,201],[201,221]].map(([sourceProductId,replacementProductId])=>({sourceProductId,replacementProductId,authorizationId:901,prescriptionRequired:false,evidence:'SYNTHETIC TEST ONLY',version:'synthetic-v1',validUntil:expiresAt}))}};
 const publicKey=Buffer.from(keys.publicKey.export({type:'spki',format:'pem'})).toString('base64');
 const signed=p=>signManifest(p,keys.privateKey);
 const settingsFor=p=>({NODE_ENV:'production',ACADEMIC_DEMO_ENABLED:'true',ACADEMIC_DEMO_DATABASE_URL:'postgresql://'+p.role+':synthetic@'+p.hosts[0]+'/'+p.database,ACADEMIC_DEMO_MANIFEST_B64:Buffer.from(canonical(signed(p))).toString('base64'),ACADEMIC_DEMO_PUBLIC_KEY_B64:publicKey,CLIENT_ORIGIN:'https://synthetic.example',JWT_SECRET:'synthetic-academic-test-signing-secret-'.repeat(2),PORT:'5000',ACADEMIC_DEMO_TRUSTED_PROXY_CIDRS:'127.0.0.1/32'});
 const settings=settingsFor(payload),config=readAcademicConfig(settings,Date.now(),{operatorSetup:phase==='setup'}),calls=[];
 const functions=new Map(),triggers=[];
 for(const path of migrationPaths){const sql=await readFile(new URL('../../database/migrations/'+path,import.meta.url),'utf8');for(const m of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (tgp_\w+)\([^]*? AS \$\$([^]*?)\$\$;/g))functions.set(m[1],m[2]);for(const m of sql.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER (\w+)/g))triggers.push({tgname:m[1],tgenabled:'O'});}
 for(const name of ['exchange_guard','exchange_reconcile']){for(let i=0;i<5;i++)triggers.push({tgname:name,tgenabled:'O'});}
 const identity={database:payload.database,role:payload.role,schema:'public',attestation:canonical(config.document),rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolbypassrls:false,rolreplication:false,owns_database:false,member_of_role:false,can_create_schema:false,can_create_temp:false,can_create:false,can_write_ledger:false,timezone:'UTC'};
 const client={release(){},connection:{stream:{encrypted:true,authorized:true,getPeerCertificate:()=>({subjectaltname:'DNS:'+host})}},async query(sql,args){calls.push({sql,args});
  if(sql.startsWith('SELECT current_database()'))return {rows:[identity]};
  if(sql==='SELECT current_schema() AS schema')return {rows:[{schema:'public'}]};
  if(sql.includes('/* academic catalog '))return {rows:[]};
  if(sql.startsWith('SELECT version,checksum'))return {rows:[...manifest.entries].sort((a,b)=>a.version.localeCompare(b.version))};
  if(sql.startsWith('SELECT proname,prosrc'))return {rows:[...functions].map(([proname,prosrc])=>({proname,prosrc}))};
  if(sql.startsWith('SELECT t.tgname'))return {rows:triggers};
  if(sql.includes('FROM pg_index'))return {rows:[{n:0}]};
  if(sql.includes("module='academic_setup'"))return {rows:[{n:1}]};
  if(['BEGIN READ ONLY','ROLLBACK'].includes(sql))return {rows:[]};
  throw Error('Unexpected fixture query');
 }};
 return {payload,config,settings,settingsFor,signed,identity,client,calls,pool:{connect:async()=>client}};
}
