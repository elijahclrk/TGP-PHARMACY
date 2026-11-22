import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getPool, closePool } from '../src/config/database.js';

const expectedHash = 'beb63ee013b74b7d3bde6e6f1d24adaccf7b2ca01dfa2beab7252e4a5c05ead2';
const version = '001_phase3_baseline.sql';
const apply = process.argv[2] === '--apply';
if (!['--check', '--apply'].includes(process.argv[2]) || process.argv.length !== 3) {
  console.error('Usage: node database/apply-baseline.mjs --check|--apply');
  process.exit(1);
}
let client;
let transaction = false;
let stage = 'local validation';
try {
  const bytes = await readFile(new URL('./migrations/001_phase3_baseline.sql', import.meta.url));
  const checksum = createHash('sha256').update(bytes).digest('hex');
  if (checksum !== expectedHash) throw new Error('BASELINE_CHECKSUM_MISMATCH');
  const sql = bytes.toString();
  const plain = sql.replace(/--[^\n]*/g, '');
  const tables = [...plain.matchAll(/CREATE TABLE (\w+)\s*\(/g)].map(m => m[1]);
  if (tables.length !== 15 || (plain.match(/PRIMARY KEY/g)||[]).length !== 15 || (plain.match(/REFERENCES/g)||[]).length !== 24) throw new Error('BASELINE_COUNTS_INVALID');
  console.log('Local validation: approved checksum, 15 tables, 15 PKs, 24 FKs.');
  stage = 'database connection';
  client = await getPool().connect();
  await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  transaction = true;
  await client.query('SET LOCAL search_path = public');
  await client.query("SET LOCAL lock_timeout = '5s'");
  if (apply) await client.query('SELECT pg_advisory_xact_lock(742901, 1)');
  stage = 'existing schema check';
  const objects = (await client.query(
    "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','f','S') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')"
  )).rows;
  const tracker = objects.some(o => o.schema === 'public' && o.name === 'tgp_schema_migrations');
  const application = objects.filter(o => !(o.schema === 'public' && o.name === 'tgp_schema_migrations'));
  const unexpected = application.filter(o => o.schema !== 'public' || !tables.includes(o.name));
  if (unexpected.length) throw new Error('UNEXPECTED_DATABASE_OBJECTS');
  const verify = async () => {
    const rows = (await client.query("SELECT c.relname, count(*) FILTER (WHERE k.contype='p')::int AS pks, count(*) FILTER (WHERE k.contype='f')::int AS fks FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_constraint k ON k.conrelid=c.oid WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY($1::text[]) GROUP BY c.relname", [tables])).rows;
    if (rows.length !== 15 || rows.some(r=>r.pks!==1) || rows.reduce((n,r)=>n+r.fks,0)!==24) throw new Error('SCHEMA_VERIFICATION_FAILED');
    console.log('Catalog verification: 15 application tables, 15 primary keys, 24 foreign keys.');
  };
  let recorded;
  if (tracker) {
    const records = (await client.query('SELECT version, checksum FROM public.tgp_schema_migrations')).rows;
    if(records.some(r=>r.version!==version)) throw new Error('UNEXPECTED_MIGRATION_HISTORY');
    recorded = records.find(r=>r.version===version);
  }
  if(recorded) {
    if(recorded.checksum!==checksum) throw new Error('RECORDED_CHECKSUM_MISMATCH');
    await verify();
    console.log('Already applied; matching checksum. No changes performed.');
    await client.query('ROLLBACK'); transaction=false;
  } else {
    if(application.length) throw new Error('EXISTING_UNTRACKED_APPLICATION_TABLES');
    console.log('Preflight: no application tables or unexpected user relations.');
    if(!apply) {
      await client.query('ROLLBACK'); transaction=false;
      console.log('Read-only preflight complete.');
    } else {
      stage='transactional SQL compatibility validation';
      await client.query('SAVEPOINT syntax_validation');
      await client.query(sql);
      await verify();
      await client.query('ROLLBACK TO SAVEPOINT syntax_validation');
      await client.query('RELEASE SAVEPOINT syntax_validation');
      console.log('PostgreSQL parsed and validated baseline; rehearsal rolled back.');
      stage='baseline application';
      await client.query(sql);
      await verify();
      for(const table of tables) {
        const result=await client.query('SELECT count(*)::int AS count FROM public.' + table);
        if(result.rows[0].count!==0) throw new Error('APPLICATION_DATA_NOT_EMPTY');
      }
      if(!tracker) await client.query('CREATE TABLE public.tgp_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL CHECK (length(checksum)=64), applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
      await client.query('INSERT INTO public.tgp_schema_migrations (version, checksum) VALUES ($1,$2)',[version,checksum]);
      stage='commit';
      await client.query('COMMIT'); transaction=false;
      console.log('Committed baseline and checksum record atomically; all 15 application tables empty.');
      stage='post-commit verification';
      await verify();
      const recordedRows=(await client.query('SELECT version FROM public.tgp_schema_migrations WHERE version=$1 AND checksum=$2',[version,checksum])).rows;
      if(recordedRows.length!==1) throw new Error('TRACKING_VERIFICATION_FAILED');
      console.log('Verified committed migration record. Proposed migrations were not read or executed.');
    }
  }
} catch(error) {
  if(transaction && client) await client.query('ROLLBACK').catch(()=>{});
  const safe = new Set(['BASELINE_CHECKSUM_MISMATCH','BASELINE_COUNTS_INVALID','UNEXPECTED_DATABASE_OBJECTS','UNEXPECTED_MIGRATION_HISTORY','RECORDED_CHECKSUM_MISMATCH','EXISTING_UNTRACKED_APPLICATION_TABLES','SCHEMA_VERIFICATION_FAILED','APPLICATION_DATA_NOT_EMPTY','TRACKING_VERIFICATION_FAILED','EACCES','EPERM']);
  const label=safe.has(error.message)?error.message:safe.has(error.code)?error.code:'DATABASE_OPERATION_FAILED';
  console.error('Stopped during '+stage+': '+label+'. No raw database error or connection details logged.');
  if(stage==='commit'||stage==='post-commit verification') console.error('Commit may have succeeded; rerun --check to inspect tracking before any further action.');
  process.exitCode=1;
} finally {
  client?.release();
  await closePool().catch(()=>{process.exitCode=1;});
}
