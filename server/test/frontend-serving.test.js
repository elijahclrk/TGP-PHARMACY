import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import {listenForFetch} from '../testing/local-http.mjs';
import express from 'express';
import { serveFrontend } from '../src/middleware/frontend.js';

test('production static hosting preserves API boundaries, deep links, cache rules and secret exclusion',async t=>{
  const parent=resolve(tmpdir()),directory=await mkdtemp(join(parent,'tgp-static-test-'));
  assert(resolve(directory).startsWith(parent+sep));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,'assets'));
  await writeFile(join(directory,'index.html'),'<html>static fixture</html>');
  await writeFile(join(directory,'assets','app-hash.js'),'fixture');
  await writeFile(join(directory,'.env'),'synthetic private fixture');
  const app=express();app.get('/api/health',(_req,res)=>res.json({success:true}));
  serveFrontend(app,directory);app.use((_req,res)=>res.status(404).json({success:false}));
  const server=await listenForFetch(app);t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  for(const path of ['/','/login','/products','/stock-ins','/pos','/reports']) {
    const response=await fetch(url+path);assert.equal(response.status,200);assert.match(await response.text(),/static fixture/);assert.equal(response.headers.get('cache-control'),'no-store');
  }
  const asset=await fetch(url+'/assets/app-hash.js');assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/immutable/);
  assert.equal((await fetch(url+'/api/health')).status,200);
  for(const path of ['/api','/api/missing','/API/missing','/assets/missing.js','/.env','/%2eenv','/server/.env']) {
    const response=await fetch(url+path);assert.equal(response.status,404,path);assert(!String(await response.text()).includes('synthetic private'));
  }
});
test('production startup refuses a missing frontend bundle',()=>{
  assert.throws(()=>serveFrontend(express(),join(tmpdir(),'tgp-no-such-build',String(Date.now()))),/frontend build missing/);
});
