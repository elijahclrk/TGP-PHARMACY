import pg from 'pg';
import {createHash} from 'node:crypto';
import {checkServerIdentity} from 'node:tls';
import {academicTargetUrl,canonical,refuse} from './manifest.js';

const namespaces = "n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND n.nspname !~ '^pg_(temp|toast_temp)_'";
const catalog = {
 schemas: `SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl::text AS acl,
 has_schema_privilege(current_user,n.oid,'USAGE') AS usable,
 has_schema_privilege(current_user,n.oid,'CREATE') AS writable FROM pg_namespace n WHERE ${namespaces}`,
 relations: `SELECT nspname,relname,relkind,pg_get_userbyid(relowner) AS owner,relacl::text AS acl,reloptions,
 CASE WHEN c.relkind='v' THEN has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
 OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES') ELSE false END AS view_write,
 has_schema_privilege(current_user,n.oid,'USAGE') AS usable,
 CASE WHEN relkind='S' THEN has_sequence_privilege(current_user,c.oid,'SELECT,USAGE,UPDATE')
 ELSE has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
 OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') END AS accessible,
 CASE WHEN relkind IN ('v','m') THEN pg_get_viewdef(c.oid) END AS definition
 FROM pg_class c JOIN pg_namespace n ON n.oid=relnamespace
 WHERE relkind IN ('r','p','v','m','f','S') AND ${namespaces}`,
 columns: `SELECT nspname,relname,attname,attacl::text AS acl FROM pg_attribute a
 JOIN pg_class c ON c.oid=attrelid JOIN pg_namespace n ON n.oid=relnamespace
 WHERE attnum>0 AND NOT attisdropped AND attacl IS NOT NULL AND ${namespaces}`,
 routines: `SELECT nspname,proname,oidvectortypes(p.proargtypes) AS args,pg_get_userbyid(proowner) AS owner,
 prosecdef,proacl::text AS acl,has_schema_privilege(current_user,n.oid,'USAGE') AS usable,
 has_function_privilege(current_user,p.oid,'EXECUTE') AS executable,
 CASE WHEN prokind IN ('f','p','w') THEN pg_get_functiondef(p.oid) END AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=pronamespace WHERE ${namespaces}`,
 extensions: 'SELECT extname,extversion,pg_get_userbyid(extowner) AS owner FROM pg_extension',
};

const reviewedViews = new Set(['pg_stat_statements','pg_stat_statements_info']);
const reviewedRoutines = new Set(['pg_stat_statements(boolean)','pg_stat_statements_info()',
 'health_check_write_succeeds()','get_compute_primary_memory_bytes()']);

export function managedPostgresFingerprint(snapshot) {
 if (snapshot.schemas.some(row=>row.writable!==false)) refuse();
 if (snapshot.relations.some(row=>row.usable&&row.accessible&&
  !(row.nspname==='public'&&row.owner==='cloud_admin'&&row.relkind==='v'&&row.view_write===false&&reviewedViews.has(row.relname)))) refuse();
 if (snapshot.routines.some(row=>row.usable&&row.executable&&
  !(row.nspname==='public'&&row.owner==='cloud_admin'&&row.prosecdef===false&&reviewedRoutines.has(row.proname+'('+row.args+')')))) refuse();
 const sorted=Object.fromEntries(Object.entries(snapshot).map(([key,rows])=>[key,rows.map(canonical).sort()]));
 return createHash('sha256').update(canonical(sorted)).digest('hex');
}

export async function readManagedPostgresSnapshot(config,{createClient=options=>new pg.Client(options)}={}) {
 const target=config.document.payload;
 if(target.database!=='tgp_demo_academic_web'||target.role!=='tgp_academic_runtime_sql')refuse();
 const url=academicTargetUrl(config.url,target);
 if(url.hostname.includes('-pooler.')||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')refuse();
 url.pathname='/postgres';
 url.search='';
 const client=createClient({connectionString:url.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true,
  options:'-c search_path=pg_catalog -c timezone=UTC',connectionTimeoutMillis:10000,statement_timeout:10000});
 let transaction=false;
 try{
  await client.connect();
  const tls=client.connection?.stream;
  if(!tls?.encrypted||!tls.authorized||checkServerIdentity(url.hostname,tls.getPeerCertificate()))refuse();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  transaction=true;
  const {rows:[identity]}=await client.query(`SELECT current_database() AS database,current_user AS actor,session_user AS login,
   pg_get_userbyid(d.datdba) AS owner, current_setting('transaction_read_only') AS read_only,
   NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls)
   AND NOT EXISTS(SELECT FROM pg_auth_members m WHERE m.member=r.oid)
   AND NOT EXISTS(SELECT FROM pg_database b WHERE b.datdba=r.oid)
   AND NOT EXISTS(SELECT FROM pg_database b WHERE b.datallowconn AND NOT b.datistemplate
    AND b.datname NOT IN ('postgres','tgp_demo_academic_web') AND has_database_privilege(r.oid,b.oid,'CONNECT'))
   AND NOT has_database_privilege(r.oid,d.oid,'CREATE')
   AND NOT EXISTS(SELECT FROM pg_largeobject_metadata o WHERE has_largeobject_privilege(r.oid,o.oid,'SELECT,UPDATE'))
   AS restricted FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()`);
  if(identity?.database!=='postgres'||identity.owner!=='cloud_admin'||identity.actor!==target.role||
   identity.login!==target.role||identity.read_only!=='on'||identity.restricted!==true)refuse();
  const snapshot={};
  for(const [name,sql]of Object.entries(catalog))snapshot[name]=(await client.query(sql)).rows;
  return snapshot;
 }catch{refuse();}
 finally{try{if(transaction)await client.query('ROLLBACK');}finally{await client.end();}}
}

export async function verifyManagedPostgres(config,options) {
 const expected=config.document.payload.managedPostgresDigest;
 if(expected&&managedPostgresFingerprint(await readManagedPostgresSnapshot(config,options))!==expected)refuse();
}
