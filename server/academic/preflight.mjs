// Operator-only EMPTY-target inspection. No dotenv, migrations, grants or seed.
import pg from 'pg';
import {checkServerIdentity} from 'node:tls';
import {validateAcademicTarget,academicTargetUrl,academicOperatorMatches} from '../src/academic/manifest.js';
import {verifyManagedPostgres} from '../src/academic/managed-postgres.js';

export class AcademicPreflightError extends Error {
 constructor(check){super('ACADEMIC_PREFLIGHT_REFUSED');this.check=check;}
}
const requireCheck=(ok,check)=>{if(!ok)throw new AcademicPreflightError(check);};

// Opt in only for local operator tooling. The host is the same direct endpoint
// pinned by the target configuration and used by the restricted runtime.
export function usesAcademicOwner(target,input){
 if(input.setupAsDatabaseOwner!==true)return false;
 const owner=new URL(input.operatorUrl),runtime=academicTargetUrl(input.runtimeUrl,target);
 requireCheck(target.database==='tgp_demo_academic_web'&&target.role==='tgp_academic_runtime_sql'
  &&owner.username==='neondb_owner'&&owner.hostname===runtime.hostname
  &&!owner.hostname.includes('-pooler.')&&owner.pathname===runtime.pathname
  &&['postgres:','postgresql:'].includes(owner.protocol)&&owner.password&&!owner.hash
  &&(!owner.port||owner.port==='5432')
  &&[...owner.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k))
  &&process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0','owner_setup_target');
 return true;
}

// An unsigned, inspection-only descriptor. It is not a runtime config and cannot
// pass readManifest/verifiedAcademicContext. No origin, key or JWT is fabricated.
export function readInspectionConfig(input,now=Date.now()){
 const target=input?.target;
 validateAcademicTarget(target);
 const start=Date.parse(input.issuedAt),end=Date.parse(input.expiresAt);
 requireCheck(Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>now&&end>start&&end-start<=7*86400000,'inspection_window');
 const payload=Object.freeze({...target,hosts:Object.freeze([...target.hosts]),phase:'setup'});
 return Object.freeze({document:Object.freeze({payload}),url:academicTargetUrl(input.runtimeUrl,payload).toString()});
}

const identitySql=`SELECT current_database() AS database,current_user AS role,
 session_user AS session_role,current_schema() AS schema,
 current_setting('TimeZone') AS timezone,current_setting('transaction_read_only') AS read_only,
 shobj_description(d.oid,'pg_database') AS database_comment,
 pg_get_userbyid(d.datdba) AS database_owner,
 r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,r.rolreplication,
 pg_has_role(current_user,d.datdba,'MEMBER') AS owns_database,
 pg_has_role(current_user,d.datdba,'USAGE') AS usable_owner,
 pg_has_role(current_user,n.nspowner,'USAGE') AS owns_schema,
 EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS member_of_role,
 EXISTS(SELECT 1 FROM pg_database other WHERE other.datdba=r.oid) AS owns_any_database,
 has_database_privilege(current_user,d.oid,'CONNECT') AS can_connect,
 has_database_privilege(current_user,d.oid,'CREATE') AS can_create_schema,
 has_database_privilege(current_user,d.oid,'TEMP') AS can_create_temp,
 has_schema_privilege(current_user,n.oid,'USAGE') AS can_use_schema,
 has_schema_privilege(current_user,n.oid,'CREATE') AS can_create,
 EXISTS(SELECT 1 FROM pg_database other WHERE other.datallowconn AND NOT other.datistemplate
  AND other.datname<>current_database() AND has_database_privilege(current_user,other.oid,'CONNECT')) AS other_database_connect
 FROM pg_database d JOIN pg_roles r ON r.rolname=current_user
 JOIN pg_namespace n ON n.nspname='public' WHERE d.datname=current_database()
 /* academic empty preflight identity */`;

const objectsSql=`WITH app AS (
 SELECT oid,nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema'
 ) SELECT
 (SELECT count(*)::int FROM pg_class WHERE relnamespace IN(SELECT oid FROM app)) AS relations,
 (SELECT count(*)::int FROM pg_proc WHERE pronamespace IN(SELECT oid FROM app)) AS routines,
 (SELECT count(*)::int FROM pg_type WHERE typnamespace IN(SELECT oid FROM app)) AS types,
 (SELECT count(*)::int FROM app WHERE nspname<>'public') AS extra_schemas,
 (SELECT count(*)::int FROM pg_extension WHERE extname<>'plpgsql') AS extra_extensions,
 (SELECT count(*)::int FROM pg_event_trigger) AS event_triggers,
 (SELECT count(*)::int FROM pg_publication) AS publications,
 (SELECT count(*)::int FROM pg_operator WHERE oprnamespace IN(SELECT oid FROM app)) AS operators,
 (SELECT count(*)::int FROM pg_collation WHERE collnamespace IN(SELECT oid FROM app)) AS collations,
 (SELECT count(*)::int FROM pg_conversion WHERE connamespace IN(SELECT oid FROM app)) AS conversions,
 (SELECT count(*)::int FROM pg_ts_config WHERE cfgnamespace IN(SELECT oid FROM app)) AS text_configs,
 (SELECT count(*)::int FROM pg_ts_dict WHERE dictnamespace IN(SELECT oid FROM app)) AS text_dictionaries,
 (SELECT count(*)::int FROM pg_ts_parser WHERE prsnamespace IN(SELECT oid FROM app)) AS text_parsers,
 (SELECT count(*)::int FROM pg_ts_template WHERE tmplnamespace IN(SELECT oid FROM app)) AS text_templates
 /* academic empty preflight objects */`;
const objectFields=['relations','routines','types','extra_schemas','extra_extensions','event_triggers','publications','operators','collations','conversions','text_configs','text_dictionaries','text_parsers','text_templates'];

export function tlsVerified(client,host){
 const stream=client.connection?.stream;
 requireCheck(stream?.encrypted===true&&stream.authorized===true,'tls_authorization');
 requireCheck(!checkServerIdentity(host,stream.getPeerCertificate()),'tls_hostname');
}

export async function inspectAcademicTarget(config,input,{createClient=options=>new pg.Client(options)}={}){
 const p=config.document.payload;
 requireCheck(p.phase==='setup','setup_phase');
 let operator,runtime;
 try{operator=new URL(input.operatorUrl);runtime=new URL(config.url);}catch{throw new AcademicPreflightError('operator_target');}
 requireCheck(['postgres:','postgresql:'].includes(operator.protocol)&&p.hosts.includes(operator.hostname)
  &&decodeURIComponent(operator.pathname.slice(1))===p.database
  &&operator.username&&operator.password&&!operator.hash&&(!operator.port||operator.port==='5432')
  &&[...operator.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k))
  &&decodeURIComponent(operator.username)!==p.role,'operator_target');
 requireCheck(decodeURIComponent(runtime.username)===p.role&&decodeURIComponent(runtime.pathname.slice(1))===p.database
  &&p.hosts.includes(runtime.hostname),'runtime_target');
 const operatorRole=decodeURIComponent(operator.username);
 const ownerSetup=usesAcademicOwner(p,{...input,runtimeUrl:config.url});
 requireCheck(ownerSetup||academicOperatorMatches(p.role,operatorRole),'operator_role');
 // Both URLs are explicit inputs, never process.env or the ordinary pool.
 for(const [actor,url,expectedRole]of [['operator',operator,operatorRole],['runtime',runtime,p.role]]){
  url.search='';
  const client=createClient({connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,
   options:'-c timezone=UTC -c search_path=public',connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:10000});
  let begun=false;
  try{
   await client.connect();tlsVerified(client,url.hostname);
   await client.query('BEGIN READ ONLY');begun=true;
   const row=(await client.query(identitySql)).rows[0];
   requireCheck(row?.database===p.database&&row.role===expectedRole&&row.session_role===expectedRole&&row.schema===p.schema,actor+'_identity');
   requireCheck(row.read_only==='on'&&['UTC','GMT'].includes(row.timezone),actor+'_session');
   requireCheck(row.rolcanlogin===true&&row.can_connect===true,actor+'_login');
   requireCheck(row.database_comment===null,'unexpected_database_comment');
   if(actor==='operator'){
    if(ownerSetup)requireCheck(row.database_owner==='neondb_owner','owner_setup_identity');
    requireCheck(['owns_database','usable_owner','owns_schema','can_create_schema','can_use_schema','can_create'].every(k=>row[k]===true),'operator_permissions');
   }else{
    requireCheck(row.member_of_role===false,'runtime_membership');
    requireCheck(['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls','rolreplication'].every(k=>row[k]===false),'runtime_elevated_privileges');
    requireCheck(['owns_database','owns_any_database','can_create_schema','can_create_temp','can_create'].every(k=>row[k]===false),'runtime_ownership_or_ddl');
    if(!p.managedPostgresDigest)requireCheck(row.other_database_connect===false,'runtime_other_database_access');
   }
   const objects=(await client.query(objectsSql)).rows[0];
   requireCheck(objects&&objectFields.every(k=>objects[k]===0),'unexpected_database_objects');
  }finally{
   try{if(begun)await client.query('ROLLBACK');}finally{await client.end();}
  }
 }
 await verifyManagedPostgres(config,{createClient});
 return {targetVerified:true,readOnly:true,operatorVerified:true,runtimeVerified:true,emptyDatabase:true,
  runtimeRoleIsolation:true,changesApplied:false};
}
