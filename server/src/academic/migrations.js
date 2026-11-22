import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonical,refuse} from './manifest.js';
export const migrationPaths=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql','proposed/003_return_sale_item_link.sql','proposed/batch1/007_decision_workflows.sql','proposed/batch1/008_return_dispositions.sql','proposed/batch1/009_discount_financial_snapshots.sql','proposed/batch10/011_local_benefit_checkout.sql','proposed/batch13/012_local_product_exchanges.sql','proposed/batch7/010_in_app_notification_preferences.sql','proposed/batch14/013_operational_completion.sql'];
const protectedHashes=['beb63ee013b74b7d3bde6e6f1d24adaccf7b2ca01dfa2beab7252e4a5c05ead2','dc16e6f9338d53bbb1e39d208d8deb285acb1fd3ea1754e9cffb094227796535','d327e2845119b31a9b3b509bfc56f21aac3225a0d043dd393195df71626ea23f'];
export async function migrationManifest(){
 const entries=[];
 for(const [i,path]of migrationPaths.entries()){
  const bytes=await readFile(new URL('../../database/migrations/'+path,import.meta.url));const checksum=createHash('sha256').update(bytes).digest('hex');
  if(i<3&&checksum!==protectedHashes[i])refuse();
  entries.push({version:path.split('/').at(-1),checksum});
 }
 return {entries,digest:createHash('sha256').update(canonical(entries)).digest('hex')};
}
export async function verifyCanonicalSchema(client){
 const expected=new Map(),triggers=new Set();
 for(const path of migrationPaths){const sql=await readFile(new URL('../../database/migrations/'+path,import.meta.url),'utf8');
  for(const m of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (tgp_\w+)\([^]*? AS \$\$([^]*?)\$\$;/g))expected.set(m[1],m[2]);
  for(const m of sql.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER (\w+)/g))triggers.add(m[1]);
 }
 const actual=(await client.query("SELECT proname,prosrc FROM pg_proc WHERE pronamespace=current_schema()::regnamespace AND proname LIKE 'tgp_%'")).rows;
 const norm=s=>s?.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
 for(const[name,body]of expected)if(actual.filter(r=>r.proname===name&&norm(r.prosrc)===norm(body)).length!==1)refuse();
 const installed=(await client.query("SELECT t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=current_schema()::regnamespace AND NOT t.tgisinternal")).rows;
 for(const name of triggers)if(!installed.some(t=>t.tgname===name&&t.tgenabled==='O'))refuse();
 if(installed.filter(t=>t.tgname==='exchange_guard'&&t.tgenabled==='O').length!==6||installed.filter(t=>t.tgname==='exchange_reconcile'&&t.tgenabled==='O').length!==6)refuse();
 if((await client.query("SELECT count(*)::int AS n FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace=current_schema()::regnamespace AND NOT i.indisvalid")).rows[0]?.n!==0)refuse();
}
export async function schemaFingerprint(c){
 const schema=(await c.query('SELECT current_schema() AS schema')).rows[0].schema;
 const catalog={
  access:(await c.query('SELECT n.nspacl::text AS schema_acl,d.datacl::text AS database_acl FROM pg_namespace n CROSS JOIN pg_database d WHERE n.oid=current_schema()::regnamespace AND d.datname=current_database() /* academic catalog access */')).rows,
  functions:(await c.query('SELECT proname,prosrc,prosecdef,provolatile,proconfig FROM pg_proc WHERE pronamespace=current_schema()::regnamespace ORDER BY proname,oid::regprocedure::text /* academic catalog functions */')).rows,
  columns:(await c.query("SELECT t.relname,t.relacl::text AS acl,a.attname,a.attacl::text AS column_acl,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_class t JOIN pg_attribute a ON a.attrelid=t.oid LEFT JOIN pg_attrdef d ON d.adrelid=t.oid AND d.adnum=a.attnum WHERE t.relnamespace=current_schema()::regnamespace AND t.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY t.relname,a.attnum /* academic catalog columns */")).rows,
  constraints:(await c.query('SELECT conname,convalidated,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace=current_schema()::regnamespace ORDER BY conname,conrelid::regclass::text /* academic catalog constraints */')).rows,
  indexes:(await c.query('SELECT t.relname,i.indisvalid,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class t ON t.oid=i.indexrelid WHERE t.relnamespace=current_schema()::regnamespace ORDER BY t.relname /* academic catalog indexes */')).rows,
  triggers:(await c.query('SELECT t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=current_schema()::regnamespace AND NOT t.tgisinternal ORDER BY c.relname,t.tgname /* academic catalog triggers */')).rows,
 };
 return createHash('sha256').update(canonical(JSON.parse(JSON.stringify(catalog).replaceAll(schema+'.','')))).digest('hex');
}
