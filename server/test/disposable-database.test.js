import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disposableConfig, verifyDisposableClient } from './support/disposable-database.js';
const production = 'postgresql://owner:synthetic@production.example/production';
const settings = { TEST_DATABASE_URL: 'postgresql://tester:synthetic@disposable.example/test_only', TEST_DATABASE_DISPOSABLE: 'true', TEST_DATABASE_EXPECTED_HOST: 'disposable.example', TEST_DATABASE_EXPECTED_NAME: 'test_only', TEST_DATABASE_ATTESTATION: 'synthetic_disposable_attestation_12345' };
test('write-test guard refuses production fallback, same host/database, aliases and incomplete attestation before connecting', () => {
  for (const bad of [{}, {...settings, TEST_DATABASE_DISPOSABLE: 'false'}, {...settings, TEST_DATABASE_URL: production},
    {...settings, TEST_DATABASE_URL: 'postgres://other:synthetic@production.example/other'},
    {...settings, TEST_DATABASE_URL: 'postgres://other:synthetic@production-pooler.example/other'},
    {...settings, TEST_DATABASE_URL: 'postgres://other:synthetic@disposable.example/production'},
    {...settings, TEST_DATABASE_URL: settings.TEST_DATABASE_URL+'?host=production.example'},
    {...settings, TEST_DATABASE_URL: settings.TEST_DATABASE_URL+'?options=-c%20search_path=public'},
    {...settings, TEST_DATABASE_EXPECTED_HOST: 'wrong'}, {...settings, TEST_DATABASE_ATTESTATION: ''},
  ]) assert.throws(() => disposableConfig(bad, production), /Write tests refused/);
  assert.throws(() => disposableConfig(settings, ''), /Write tests refused/);
  assert.equal(disposableConfig(settings, production).target.database, 'test_only');
});
test('unverified TLS and mismatched local server address/port are refused before writes', async()=>{
  const approved=disposableConfig({...settings,TEST_DATABASE_URL:'postgres://test:synthetic@127.0.0.1:65432/test_only',TEST_DATABASE_EXPECTED_HOST:'127.0.0.1'},production);
  for(const stream of [{encrypted:false,authorized:true},{encrypted:true,authorized:false},{}]){
    await assert.rejects(()=>verifyDisposableClient({connection:{stream},query(){throw Error('Must not query without TLS');}},approved),/Write tests refused/);
  }
  for(const extra of [{address:'127.0.0.2',port:65432,ssl:true},{address:'127.0.0.1',port:5432,ssl:true},{address:'127.0.0.1',port:65432,ssl:false}]){
    const client={connection:{stream:{encrypted:true,authorized:true}},async query(){return {rows:[{database:'test_only',token:settings.TEST_DATABASE_ATTESTATION,...extra}]};}};
    await assert.rejects(()=>verifyDisposableClient(client,approved),/Write tests refused/);
  }
});
test('test connection requires external DB-level attestation in READ ONLY transaction before writes', async () => {
  const approved = disposableConfig(settings, production);
  for (const row of [{database:'test_only',token:settings.TEST_DATABASE_ATTESTATION},{database:'production',token:settings.TEST_DATABASE_ATTESTATION},{database:'test_only',token:null}]) {
    const calls = [], client = { connection:{stream:{encrypted:true,authorized:true}}, async query(sql) { calls.push(sql); return { rows: [{...row,ssl:true}] }; } };
    if (row.database === 'test_only' && row.token) await verifyDisposableClient(client, approved);
    else await assert.rejects(() => verifyDisposableClient(client, approved), /Write tests refused/);
    assert.equal(calls[0], 'BEGIN READ ONLY'); assert.equal(calls.at(-1), 'ROLLBACK');
    assert(calls.every(sql => /^(BEGIN READ ONLY|SELECT |ROLLBACK)/.test(sql)));
  }
});
