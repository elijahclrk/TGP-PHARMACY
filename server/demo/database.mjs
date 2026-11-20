import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { marker, refuse, activateDemo } from './config.mjs';

const files=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql'];
const hashes=['beb63ee013b74b7d3bde6e6f1d24adaccf7b2ca01dfa2beab7252e4a5c05ead2','dc16e6f9338d53bbb1e39d208d8deb285acb1fd3ea1754e9cffb094227796535','d327e2845119b31a9b3b509bfc56f21aac3225a0d043dd393195df71626ea23f'];
export async function migrations() {
  const result=[];
  for(let i=0;i<files.length;i++) {
    const bytes=await readFile(new URL('../database/migrations/'+files[i],import.meta.url));
    if(createHash('sha256').update(bytes).digest('hex')!==hashes[i])refuse('MIGRATION_CHECKSUM_MISMATCH');
    let sql=bytes.toString().replace(/--[^\n]*/g,'').trim();
    if(i){if(!sql.startsWith('BEGIN;')||!sql.endsWith('COMMIT;'))refuse('MIGRATION_WRAPPER_INVALID');sql=sql.slice(6,-7);}
    result.push({version:files[i].split('/').at(-1),checksum:hashes[i],sql});
  }
  return result;
}
export async function demoPool(config) {
  activateDemo(config);
  const [{default:pg},{createPoolConfig}]=await Promise.all([import('pg'),import('../src/config/database.js')]);
  return new pg.Pool({...createPoolConfig(config.values.DEMO_DATABASE_URL),options:'-c timezone=UTC'});
}
export async function checkIdentity(client,config) {
  const row=(await client.query("SELECT current_database() AS db,obj_description('public'::regnamespace,'pg_namespace') AS marker")).rows[0];
  if(row.db!==config.database)refuse('CONNECTED_DATABASE_MISMATCH');
  return row.marker;
}
export async function verifySchema(client,config) {
  if(await checkIdentity(client,config)!==marker)refuse('DEMO_DATABASE_MARKER_MISSING');
  const expected=(await migrations()).map(({version,checksum})=>({version,checksum}));
  const history=(await client.query('SELECT version,checksum FROM public.tgp_schema_migrations ORDER BY version')).rows;
  if(JSON.stringify(history)!==JSON.stringify(expected))refuse('DEMO_MIGRATION_HISTORY_MISMATCH');
  const rows=(await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name")).rows;
  const tables=[...(await migrations())[0].sql.matchAll(/CREATE TABLE (\w+)/g)].map(m=>m[1]);
  const names=[...new Set(rows.map(r=>r.table_name))].sort();
  if(JSON.stringify(names)!==JSON.stringify([...tables,'tgp_schema_migrations'].sort()) || rows.some(r=>r.column_name==='image_public_id'))refuse('UNEXPECTED_DEMO_SCHEMA');
  const keys=(await client.query("SELECT contype,count(*)::int AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND contype IN ('p','f') GROUP BY contype")).rows;
  if(keys.find(r=>r.contype==='p')?.n!==16 || keys.find(r=>r.contype==='f')?.n!==24)refuse('DEMO_KEY_COUNTS_MISMATCH');
  return tables;
}
export async function initializeDemo(config) {
  const pending=await migrations(),pool=await demoPool(config);let client;
  try {
    client=await pool.connect();await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query('SELECT pg_advisory_xact_lock(742901,99)');
    const existingMarker=await checkIdentity(client,config);
    if(existingMarker===marker){await verifySchema(client,config);await client.query('ROLLBACK');return 'Already initialized; schema/history verified. No changes.';}
    const count=(await client.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f','S') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')")).rows[0].n;
    if(count || (existingMarker && existingMarker!=='standard public schema'))refuse('DATABASE_NOT_EMPTY_OR_NOT_OWNED');
    await client.query('SET LOCAL search_path TO public');
    for(const migration of pending)await client.query(migration.sql);
    await client.query('CREATE TABLE public.tgp_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL CHECK(length(checksum)=64), applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for(const migration of pending)await client.query('INSERT INTO public.tgp_schema_migrations(version,checksum) VALUES($1,$2)',[migration.version,migration.checksum]);
    await client.query("COMMENT ON SCHEMA public IS 'TGP_ISOLATED_ACADEMIC_DEMO_V1'");
    await verifySchema(client,config);await client.query('COMMIT');
    return 'Initialized isolated schema and migration history atomically: 001/002/004 only.';
  } catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client?.release();await pool.end();}
}
