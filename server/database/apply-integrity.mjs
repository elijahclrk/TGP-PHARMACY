import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {getPool,closePool} from '../src/config/database.js';
const files=["001_phase3_baseline.sql","proposed/002_supported_integrity.sql","proposed/004_lookup_indexes.sql"];
const hashes=["beb63ee013b74b7d3bde6e6f1d24adaccf7b2ca01dfa2beab7252e4a5c05ead2","dc16e6f9338d53bbb1e39d208d8deb285acb1fd3ea1754e9cffb094227796535","d327e2845119b31a9b3b509bfc56f21aac3225a0d043dd393195df71626ea23f"];
const mode=process.argv[2];
if(!['--check','--apply'].includes(mode)||process.argv.length!==3)throw Error('Use --check or --apply');
const versions=files.map(f=>f.split('/').at(-1));
const testSchema='tgp_integrity_'+randomUUID().replaceAll('-','');
let client,active=false,stage='local checksum verification';
const expected=[];
async function snapshot(schema){
 await client.query('SET LOCAL search_path TO '+schema);
 const normalize=rows=>JSON.parse(JSON.stringify(rows).replaceAll(schema+'.',''));
 const tables=(await client.query("SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname<>'tgp_schema_migrations' AND c.relkind IN ('r','p','v','m','f','S') ORDER BY c.relname",[schema])).rows;
 const columns=(await client.query("SELECT c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relkind='r' AND c.relname<>'tgp_schema_migrations' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum",[schema])).rows;
 const constraints=(await client.query("SELECT c.relname,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname<>'tgp_schema_migrations' ORDER BY c.relname,k.conname",[schema])).rows;
 const indexes=(await client.query("SELECT c.relname,ic.relname AS name,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname<>'tgp_schema_migrations' ORDER BY c.relname,ic.relname",[schema])).rows;
 const triggers=(await client.query("SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname<>'tgp_schema_migrations' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",[schema])).rows;
 return normalize({tables,columns,constraints,indexes,triggers});
}
try{
 const sql=[];
 for(let i=0;i<files.length;i++){
  const bytes=await readFile(new URL('./migrations/'+files[i],import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hashes[i]);
  let text=bytes.toString().replace(/--[^\n]*/g,'').trim();
  if(i){assert(text.startsWith('BEGIN;')&&text.endsWith('COMMIT;'));text=text.slice(6,-7).replace(/^\s*SET LOCAL search_path = public;/,'');}
  assert(!/\b(public|COMMIT|ROLLBACK|DROP)\b/i.test(text));sql.push(text);
 }
 stage='connection';client=await getPool().connect();await client.query('BEGIN');active=true;
 await client.query("SET LOCAL lock_timeout='5s'");await client.query('SELECT pg_advisory_xact_lock(742901,1)');
 stage='history verification';
 const history=(await client.query('SELECT version,checksum FROM public.tgp_schema_migrations ORDER BY version')).rows;
 assert(history.length>=1&&history.length<=3);
 for(let i=0;i<history.length;i++)assert.deepEqual(history[i],{version:versions[i],checksum:hashes[i]});
 const unexpected=(await client.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN ('public','information_schema') AND c.relkind IN ('r','p','v','m','f','S') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')")).rows[0].n;assert.equal(unexpected,0);
 const tables=[...sql[0].matchAll(/CREATE TABLE (\w+)/g)].map(m=>m[1]);assert.equal(tables.length,15);
 await client.query('LOCK TABLE '+tables.map(t=>'public.'+t).join(',')+' IN ACCESS EXCLUSIVE MODE');
 for(const table of tables)assert.equal((await client.query('SELECT count(*)::int AS n FROM public.'+table)).rows[0].n,0);
 stage='isolated reference construction';
 await client.query('SAVEPOINT reference_schema');await client.query('CREATE SCHEMA '+testSchema);
 for(let i=0;i<sql.length;i++){await client.query('SET LOCAL search_path TO '+testSchema);await client.query(sql[i]);expected.push(await snapshot(testSchema));}
 await client.query('ROLLBACK TO SAVEPOINT reference_schema');await client.query('RELEASE SAVEPOINT reference_schema');
 stage='exact live schema comparison';assert.deepEqual(await snapshot('public'),expected[history.length-1]);
 console.log('PASS exact columns, constraints, index definitions, triggers and table settings; 15 empty tables, 15 PKs, 24 FKs; recorded checksums match.');
 if(mode==='--apply'){
  for(let i=history.length;i<sql.length;i++){
   stage='apply '+versions[i];await client.query('SET LOCAL search_path TO public');await client.query(sql[i]);
   assert.deepEqual(await snapshot('public'),expected[i]);
   await client.query('INSERT INTO public.tgp_schema_migrations(version,checksum) VALUES($1,$2)',[versions[i],hashes[i]]);
   console.log('Verified and recorded '+versions[i]);
  }
  if(history.length===3)console.log('All approved migrations already applied; safely skipped.');
  stage='commit';await client.query('COMMIT');active=false;
  stage='post-commit verification';await client.query('BEGIN READ ONLY');active=true;
  assert.deepEqual(await snapshot('public'),expected[2]);
  const recorded=(await client.query('SELECT version,checksum,applied_at FROM public.tgp_schema_migrations ORDER BY version')).rows;
  assert.equal(recorded.length,3);for(let i=0;i<3;i++){assert.equal(recorded[i].version,versions[i]);assert.equal(recorded[i].checksum,hashes[i]);assert(recorded[i].applied_at);}
  for(const table of tables)assert.equal((await client.query('SELECT count(*)::int AS n FROM public.'+table)).rows[0].n,0);
  console.log('PASS committed catalog: '+expected[2].constraints.filter(c=>c.contype==='c').length+' CHECK constraints, 40 indexes; all application tables empty.');
  console.log(JSON.stringify(recorded));
 }else console.log('Check complete; no application changes.');
 await client.query('ROLLBACK');active=false;
}catch(e){if(active&&client)await client.query('ROLLBACK').catch(()=>{});active=false;console.error('Stopped at '+stage+'; sanitized result '+(['EACCES','EPERM'].includes(e.code)?e.code:'VALIDATION_OR_DATABASE_FAILURE'));if(stage==='commit'||stage==='post-commit verification')console.error('Commit may have succeeded; check history before retry.');process.exitCode=1;}
finally{client?.release();await closePool();}
