import { test } from 'node:test';
import assert from 'node:assert/strict';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createInventoryRouter } from '../src/routes/inventory.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('threshold writes require active Admin, trusted request and valid explicit null/zero values', async t => {
  const writes=[],audits=[];
  const users={1:{user_id:1,role:'admin',status:'active'},2:{user_id:2,role:'manager',status:'active'},3:{user_id:3,role:'employee',status:'active'}};
  const app=express();app.use(cookieParser());app.use(express.json());
  app.use(createInventoryRouter({config:{origin:'http://localhost:5173',secure:false},sessions:{verify:id=>users[id]?{userId:Number(id)}:null},
    authRepository:{findById:async id=>users[id],transaction:async work=>work({}),audit:async(...args)=>audits.push(args)},
    repository:{editProduct:async(_client,id,data)=>{writes.push(data);return {product_id:id,...data};}}}));app.use(errorHandler);
  const server=await listenForFetch(app);t.after(()=>new Promise(resolve=>server.close(resolve)));
  const patch=async(body,user='1',origin='http://localhost:5173')=>fetch('http://127.0.0.1:'+server.address().port+'/products/4',{method:'PATCH',headers:{'Content-Type':'application/json',Origin:origin,'X-TGP-Request':'1',...(user?{Cookie:'tgp_session='+user}:{})},body:JSON.stringify(body)});
  assert.equal((await patch({reorder_level:0},null)).status,401);
  for(const user of ['2','3'])assert.equal((await patch({reorder_level:0},user)).status,403);
  assert.equal((await patch({reorder_level:0},'1','https://untrusted.example')).status,403);
  for(const value of [-1,1.5,'0',2147483648])assert.equal((await patch({reorder_level:value})).status,400);
  assert.equal(writes.length,0);
  for(const value of [null,0,12])assert.equal((await patch({reorder_level:value})).status,200);
  assert.deepEqual(writes,[{reorder_level:null},{reorder_level:0},{reorder_level:12}]);assert.equal(audits.length,3);
});
