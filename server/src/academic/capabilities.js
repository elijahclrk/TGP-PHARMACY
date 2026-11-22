import {canonical,readManifest,refuse} from './manifest.js';
import {migrationManifest,verifyCanonicalSchema,schemaFingerprint} from './migrations.js';
import {verifyManagedPostgres} from './managed-postgres.js';
const issued=new WeakMap();
export function academicDetails(capability,provider){
 const record=issued.get(capability);if(!record||record.provider!==provider||Date.parse(record.config.document.payload.expiresAt)<=Date.now())return null;
 return record;
}
export function requireAcademic(capability,provider){const record=academicDetails(capability,provider);if(!record)refuse();return record;}
export const isAcademic=(capability,provider)=>Boolean(academicDetails(capability,provider));
// Dependency injection permits offline inspector tests, not an HTTP issuance API.
// Only a successful signed target + SQL handshake issues a capability.
export async function verifyAcademicClient(client,config){
 readManifest(Buffer.from(canonical(config.document)).toString('base64'),config.publicKey);
 if(client.connection?.stream?.encrypted!==true||client.connection.stream.authorized!==true)refuse();
 const tlsHost=new URL(config.url).hostname;
 const {checkServerIdentity}=await import('node:tls');
 if(checkServerIdentity(tlsHost,client.connection.stream.getPeerCertificate()))refuse();
 await client.query('BEGIN READ ONLY');
 try{
  const row=(await client.query(`SELECT current_database() AS database,current_user AS role,current_schema() AS schema,
   shobj_description(d.oid,'pg_database') AS attestation,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,r.rolreplication,
   pg_has_role(current_user,d.datdba,'MEMBER') AS owns_database,
   EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS member_of_role,
   has_database_privilege(current_user,current_database(),'CREATE') AS can_create_schema,
   has_database_privilege(current_user,current_database(),'TEMP') AS can_create_temp,
   has_schema_privilege(current_user,current_schema(),'CREATE') AS can_create,
   has_table_privilege(current_user,'tgp_schema_migrations','INSERT,UPDATE,DELETE') AS can_write_ledger,
   current_setting('TimeZone') AS timezone FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()`)).rows[0];
  const p=config.document.payload;
  if(!row||row.database!==p.database||row.role!==p.role||row.schema!==p.schema||!['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls','rolreplication','owns_database','member_of_role','can_create_schema','can_create_temp','can_create','can_write_ledger'].every(k=>row[k]===false)||!['UTC','GMT'].includes(row.timezone))refuse();
  if(row.attestation!==canonical(config.document))refuse();
  const manifest=await migrationManifest();if(manifest.digest!==p.migrationDigest)refuse();
  const rows=(await client.query('SELECT version,checksum FROM tgp_schema_migrations ORDER BY version')).rows;
  if(canonical(rows)!==canonical([...manifest.entries].sort((a,b)=>a.version.localeCompare(b.version))))refuse();
  await verifyCanonicalSchema(client);
  if(await schemaFingerprint(client)!==p.schemaDigest)refuse();
  if(p.phase==='ready'){const seed=(await client.query("SELECT count(*)::int AS n FROM activity_logs WHERE module='academic_setup' AND action=$1",['seed.ready:'+p.seedId])).rows[0];if(seed?.n!==1)refuse();}
 }finally{await client.query('ROLLBACK');}
}
export async function verifiedAcademicContext(config,pool){
 config=Object.freeze({...config,document:readManifest(Buffer.from(canonical(config.document)).toString('base64'),config.publicKey),proxies:Object.freeze([...config.proxies])});
 await verifyManagedPostgres(config);
 const provider=()=>verified;
 const verified={async connect(){const c=await pool.connect();try{await verifyAcademicClient(c,config);return c;}catch(error){c.release();throw error;}},async query(...args){const c=await this.connect();try{return await c.query(...args);}finally{c.release();}}};
 const c=await verified.connect();c.release();
 const capability=Object.freeze({kind:'cloud-academic'});
 issued.set(capability,Object.freeze({provider,config}));
 return Object.freeze({capability,provider});
}
