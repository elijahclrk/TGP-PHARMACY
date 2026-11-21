import { test } from 'node:test';
import assert from 'node:assert/strict';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPurchasingRouter } from '../src/routes/purchasing.routes.js';
import { createPurchasingRepository } from '../src/repositories/purchasing.repository.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('consolidated approval reads retain RBAC and filter pending/approved with parameterized values', async t => {
  const calls=[];
  const repository=createPurchasingRepository(()=>({async query(sql,values){calls.push({sql,values});return {rows:[{total:0,data:[]}]};}}));
  const users={1:{user_id:1,role:'admin',status:'active'},2:{user_id:2,role:'manager',status:'active'},3:{user_id:3,role:'employee',status:'active'}};
  const app=express();app.use(cookieParser());app.use(express.json());
  app.use(createPurchasingRouter({config:{origin:'http://localhost:5173',secure:false},sessions:{verify:id=>users[id]?{userId:Number(id)}:null},authRepository:{findById:async id=>users[id]},repository}));app.use(errorHandler);
  const server=await listenForFetch(app);t.after(()=>new Promise(resolve=>server.close(resolve)));
  const get=async(path,user)=>fetch('http://127.0.0.1:'+server.address().port+path,{headers:user?{Cookie:'tgp_session='+user}:{}});
  for(const path of ['/purchase-orders?status=pending','/stock-ins?status=approved']) {
    assert.equal((await get(path)).status,401);assert.equal((await get(path,3)).status,403);
    for(const user of [1,2])assert.equal((await get(path,user)).status,200);
  }
  assert.equal(calls.length,4);
  assert.deepEqual(calls.map(c=>c.values[3]),['pending','pending','approved','approved']);
  assert(calls.every(c=>c.sql.includes('t.approved_by IS NULL')&&c.sql.includes('t.approved_by IS NOT NULL')));
  assert.equal((await get('/stock-ins?status=rejected',1)).status,400);
  assert.equal((await get('/stock-ins?status=pending&status=approved',1)).status,400);
});
