import {test} from 'node:test';
import assert from 'node:assert/strict';
import {managedPostgresFingerprint,verifyManagedPostgres} from '../src/academic/managed-postgres.js';

const host='ep-synthetic.example.neon.tech';
const role='tgp_academic_runtime_sql';
const snapshot={schemas:[{writable:false}],relations:[],columns:[],routines:[],extensions:[]};
const target={role,database:'tgp_demo_academic_web',hosts:[host],managedPostgresDigest:managedPostgresFingerprint(snapshot)};
const config={document:{payload:target},url:'postgresql://'+role+':synthetic@'+host+'/'+target.database};
function fixture({owner='cloud_admin',database='postgres',changed=false,unavailable=false,restricted=true}={}){
 let closed=false;
 const calls=[];
 const client={
  connection:{stream:{encrypted:true,authorized:true,getPeerCertificate:()=>({subjectaltname:'DNS:'+host})}},
  async connect(){if(unavailable)throw Error('fixture outage');},
  async query(sql){
   calls.push(sql);
   if(sql.startsWith('SELECT current_database'))return {rows:[{database,owner,actor:role,login:role,read_only:'on',restricted}]};
   if(sql.includes('FROM pg_namespace n WHERE'))return {rows:[{writable:false,...(changed?{acl:'changed'}:{})}]};
   return {rows:[]};
  },
  async end(){closed=true;},
 };
 return {calls,get closed(){return closed;},createClient(options){
  assert.equal(new URL(options.connectionString).pathname,'/postgres');
  assert.equal(options.ssl.rejectUnauthorized,true);
  return client;
 }};
}

test('managed verification checks the reviewed snapshot in a read-only transaction',async()=>{
 const f=fixture();
 await verifyManagedPostgres(config,f);
 assert.match(f.calls[0],/^BEGIN .* READ ONLY$/);
 const schemas=f.calls.find(sql=>sql.includes('FROM pg_namespace n WHERE'));
 const relations=f.calls.find(sql=>sql.includes('FROM pg_class c JOIN pg_namespace'));
 assert.doesNotMatch(schemas,/\b(?:relkind|c\.oid|view_write)\b/);
 assert.match(relations,/CASE WHEN c\.relkind='v'[\s\S]+AS view_write[\s\S]+FROM pg_class c/);
 assert.equal(f.calls.at(-1),'ROLLBACK');
 assert.equal(f.closed,true);
});
test('managed verification denies wrong identity, drift, elevated access and outages',async()=>{
 for(const failure of [{owner:'other'},{database:'neondb'},{restricted:false},{changed:true},{unavailable:true}]){
  const f=fixture(failure);
  await assert.rejects(verifyManagedPostgres(config,f),/REFUSED/);
  assert.equal(f.closed,true);
 }
 await assert.rejects(verifyManagedPostgres({...config,url:config.url.replace(host,'ep-other.example.neon.tech')},fixture()),/REFUSED/);
});
test('unexpected effective relation, sequence, schema and routine privileges fail closed',()=>{
 for(const kind of ['r','v','S']){
  assert.throws(()=>managedPostgresFingerprint({...snapshot,relations:[{usable:true,accessible:true,relkind:kind}]}),/REFUSED/);
 }
 assert.throws(()=>managedPostgresFingerprint({...snapshot,schemas:[{writable:true}]}),/REFUSED/);
 assert.throws(()=>managedPostgresFingerprint({...snapshot,routines:[{usable:true,executable:true,prosecdef:true}]}),/REFUSED/);
});
