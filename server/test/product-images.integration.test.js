import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getPool, closePool } from './support/disposable-database.js';
import { createProductImagesRepository } from '../src/repositories/product-images.repository.js';

// NEVER falls back to DATABASE_URL or production Neon. Explicit test-only URL
// and operator attestation are both required. All DDL/fixtures roll back.
test('isolated PostgreSQL image migration, constraints, stale edits and audit rollback', {
  skip: process.env.RUN_IMAGE_DB_TESTS !== '1',
}, async () => {
  const pool = getPool();
  const client = await pool.connect();
  const schema = 'tgp_images_test_' + randomUUID().replaceAll('-','');
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query(await readFile(new URL('../database/migrations/001_phase3_baseline.sql',import.meta.url),'utf8'));
    const raw = await readFile(new URL('../database/migrations/proposed/006_product_images.sql',import.meta.url),'utf8');
    const sql = raw.replace(/--[^\n]*/g,'').trim();
    assert(sql.startsWith('BEGIN;') && sql.endsWith('COMMIT;'));
    const isolated = sql.slice(6,-7).replace('SET LOCAL search_path = public;','');
    assert(!/\b(public|COMMIT|ROLLBACK|DROP)\b/i.test(isolated));
    await client.query("INSERT INTO products(product_id,name) VALUES(1,'fixture'),(2,'fixture2')");
    await client.query(isolated);
    assert.equal((await client.query('SELECT image_public_id FROM products WHERE product_id=1')).rows[0].image_public_id,null);
    const id='tgp/product-images/'+randomUUID();
    const repo=createProductImagesRepository(()=>client);
    await repo.replace(client,1,null,id);
    await assert.rejects(()=>repo.replace(client,1,null,id),{status:409});
    for(const [sql,values,code] of [
      ['UPDATE products SET image_public_id=$1 WHERE product_id=2',[id],'23505'],
      ["UPDATE products SET image_public_id='unowned' WHERE product_id=2",[],'23514'],
      [isolated,[],'42701'],
    ]) {
      await client.query('SAVEPOINT rejected');
      await assert.rejects(()=>client.query(sql,values),{code});
      await client.query('ROLLBACK TO SAVEPOINT rejected');
      await client.query('RELEASE SAVEPOINT rejected');
    }
    await client.query('SAVEPOINT failed_audit');
    await repo.replace(client,1,id,null);
    await assert.rejects(()=>client.query("INSERT INTO activity_logs(log_id,user_id,action,module,logged_at) VALUES(1,999,'fixture','product_images',CURRENT_TIMESTAMP)"),{code:'23503'});
    await client.query('ROLLBACK TO SAVEPOINT failed_audit');
    assert.equal((await repo.get(1)).image_public_id,id);
    await repo.replace(client,1,id,null);
    assert.equal((await repo.get(1)).image_public_id,null);
  } finally {
    await client.query('ROLLBACK');
    client.release();await closePool();
  }
});
