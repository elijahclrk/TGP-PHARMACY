// Explicit operator tool for an ALREADY initialized, authorized temporary
// cluster. Never imports the production pool, migrator, seed or bootstrap tools.
import {readFile,realpath,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import {rootCertificates,checkServerIdentity} from 'node:tls';
import {disposableConfig,verifyDisposableClient} from '../test/support/disposable-database.js';

const [action,rootArgument,...testFiles]=process.argv.slice(2);
if(!['bootstrap','test','verify'].includes(action)||!rootArgument)throw Error('Explicit local action and temporary instance path required');
const root=await realpath(rootArgument),temporary=await realpath(tmpdir());
assert(root.startsWith(temporary+sep)&&root.slice(temporary.length+1).startsWith('tgp-pg-'),'Only dedicated temporary clusters are permitted');
const local=JSON.parse(await readFile(join(root,'private.json'),'utf8'));
assert(local.host==='127.0.0.1'&&Number.isInteger(local.port)&&local.port>1024&&local.port!==5432);
assert(/^[a-z][a-z0-9_]+$/.test(local.database)&&local.database.startsWith('tgp_disposable_'));
function url(user,password,database){const u=new URL('postgresql://127.0.0.1');u.port=String(local.port);u.username=user;u.password=password;u.pathname='/'+database;return u.toString();}
function settings(database,user,password){return {TEST_DATABASE_URL:url(user,password,database),TEST_DATABASE_DISPOSABLE:'true',TEST_DATABASE_EXPECTED_HOST:'127.0.0.1',TEST_DATABASE_EXPECTED_NAME:database,TEST_DATABASE_ATTESTATION:local.attestation};}
// Replace DATABASE_URL for EVERY child with an intentionally unusable sentinel.
// Even an accidental application-pool import cannot connect to production.
const blocked='postgresql://blocked:synthetic@production.invalid/never_connect';
async function connect(database,user,password){
  const approved=disposableConfig(settings(database,user,password),blocked);
  const c=new pg.Client({...approved.config,ssl:{rejectUnauthorized:true,ca:await readFile(join(root,'tls','ca.crt'),'utf8')}});
  await c.connect();
  try {
    await verifyDisposableClient(c,approved);
    assert.equal((await c.query('SELECT current_user AS role')).rows[0].role,user);
    if(user===local.adminUser){
      assert.equal((await c.query('SHOW listen_addresses')).rows[0].listen_addresses,'127.0.0.1');
      assert.equal((await c.query('SHOW ssl_min_protocol_version')).rows[0].ssl_min_protocol_version,'TLSv1.2');
      assert.equal(resolve((await c.query('SHOW data_directory')).rows[0].data_directory),resolve(root,'data'));
    }
    assert(c.connection.stream.getProtocol()==='TLSv1.3'||c.connection.stream.getProtocol()==='TLSv1.2');
    return c;
  } catch(error){await c.end();throw error;}
}
if(action==='bootstrap'){
  const admin=await connect('postgres',local.adminUser,local.adminPassword);
  try {
    // Safety handshake passed before the first SQL write. Only the newly
    // initialized, loopback-bound cluster is reachable through this constructor.
    const databases=(await admin.query("SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname NOT IN ('postgres','template0','template1')")).rows;
    assert(databases.length===0||(databases.length===1&&databases[0].datname===local.database&&databases[0].owner===local.testUser));
    assert(/^[a-z][a-z0-9_]+$/.test(local.testUser)&&/^[a-f0-9]+$/.test(local.testPassword)&&/^[a-f0-9]+$/.test(local.attestation));
    if(!databases.length){
      await admin.query(`CREATE ROLE ${local.testUser} LOGIN PASSWORD '${local.testPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
      await admin.query(`CREATE DATABASE ${local.database} OWNER ${local.testUser}`);
      await admin.query(`ALTER DATABASE ${local.database} SET tgp.disposable_test_token='${local.attestation}'`);
    }
  } finally {await admin.end();}
  const c=await connect(local.database,local.testUser,local.testPassword);
  try {
    // Public contains the historical baseline required by existing suites.
    // New proposals are exercised in owned test schemas, never this baseline.
    await c.query('BEGIN');
    assert.equal((await c.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0,'Baseline setup refuses populated targets');
    await c.query('CREATE TABLE public.tgp_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL CHECK(length(checksum)=64),applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for(const [i,file]of ['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql'].entries()){
      const bytes=await readFile(new URL('../database/migrations/'+file,import.meta.url));let sql=bytes.toString();
      if(i){sql=sql.replace(/--[^\n]*/g,'').trim();assert(sql.startsWith('BEGIN;')&&sql.endsWith('COMMIT;'));sql=sql.slice(6,-7);}
      await c.query(sql);await c.query('INSERT INTO public.tgp_schema_migrations(version,checksum) VALUES($1,$2)',[file.split('/').at(-1),createHash('sha256').update(bytes).digest('hex')]);
    }
    await c.query('COMMIT');
    console.log(JSON.stringify({localOnly:true,tlsVerified:true,attestationVerified:true,port:local.port,baseline:['001','002','004'],productionAccess:false}));
  } catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();}
}else{
  const c=await connect(local.database,local.testUser,local.testPassword);
  try {
    await c.query('BEGIN READ ONLY');
    const history=(await c.query('SELECT version,checksum FROM public.tgp_schema_migrations ORDER BY version')).rows;
    const files=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql'];
    assert.equal(history.length,files.length,'Unexpected local baseline migration state');
    for(let i=0;i<files.length;i++){
      assert.equal(history[i].version,files[i].split('/').at(-1));
      assert.equal(history[i].checksum,createHash('sha256').update(await readFile(new URL('../database/migrations/'+files[i],import.meta.url))).digest('hex'));
    }
    await c.query('ROLLBACK');
    const approved=disposableConfig(settings(local.database,local.testUser,local.testPassword),blocked);
    await assert.rejects(()=>verifyDisposableClient(c,{...approved,attestation:'deliberately_wrong_attestation'}),/Write tests refused/);
    assert(checkServerIdentity('wrong.invalid',c.connection.stream.getPeerCertificate()));
    const untrusted=new pg.Client({...approved.config,ssl:{rejectUnauthorized:true,ca:rootCertificates}});
    try {await assert.rejects(()=>untrusted.connect(),e=>['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(e.code));}finally{await untrusted.end();}
    const privileges=(await c.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(privileges.rolsuper,false);assert.equal(privileges.rolcreatedb,false);assert.equal(privileges.rolcreaterole,false);
    console.log(JSON.stringify({localOnly:true,port:local.port,version:(await c.query('SHOW server_version')).rows[0].server_version,tls:c.connection.stream.getProtocol(),certificateAuthorized:c.connection.stream.authorized,attestationVerified:true,migrationChecksumsVerified:true,wrongAttestationRejected:true,wrongHostnameRejected:true,untrustedCARejected:true,testRoleUnprivileged:true,productionAccess:false}));
  }
  finally{await c.end();}
  if(action==='test'){
    const childEnv={...process.env,...settings(local.database,local.testUser,local.testPassword),DATABASE_URL:blocked,NODE_EXTRA_CA_CERTS:join(root,'tls','ca.crt'),JWT_SECRET:'isolated-test-only-synthetic-jwt-signing-key',PRODUCT_IMAGES_ENABLED:'false'};
    for(const suite of ['AUTH','INVENTORY','PURCHASING','POS','REPORTS','IMAGE','WORKFLOW'])childEnv['RUN_'+suite+'_DB_TESTS']='1';
    const files=testFiles.length?testFiles:['--test-concurrency=1'];
    const r=spawnSync(process.execPath,['--test',...files],{cwd:new URL('../',import.meta.url),env:childEnv,encoding:'utf8',maxBuffer:16*1024*1024});
    await writeFile(join(root,'last-test-run.log'),(r.stdout||'')+(r.stderr||''));
    process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
    process.exitCode=r.status??1;
  }
}
