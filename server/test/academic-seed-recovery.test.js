import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoveryPool,recoveryRequestId} from '../academic/seed-recovery.mjs';

test('recovery request IDs are stable across retries and distinct across fixtures',()=>{
 const id=recoveryRequestId('seed','restock-sale');
 assert.match(id,/^[a-f0-9-]{36}$/);
 assert.equal(id,recoveryRequestId('seed','restock-sale'));
 assert.notEqual(id,recoveryRequestId('seed','pending-sale'));
 assert.notEqual(id,recoveryRequestId('other-seed','restock-sale'));
});

test('successful inner transactions never commit partial recovery records',async()=>{
 const calls=[];
 const pool=recoveryPool({query:async sql=>calls.push(sql)});
 const first=await pool.connect(),second=await pool.connect();
 await first.query('BEGIN');
 await first.query('INSERT fixture');
 await first.query('COMMIT');
 await second.query('BEGIN');
 await second.query('ROLLBACK');
 assert.deepEqual(calls,['SAVEPOINT academic_recovery_1','INSERT fixture','RELEASE SAVEPOINT academic_recovery_1',
  'SAVEPOINT academic_recovery_2','ROLLBACK TO SAVEPOINT academic_recovery_2; RELEASE SAVEPOINT academic_recovery_2']);
});
