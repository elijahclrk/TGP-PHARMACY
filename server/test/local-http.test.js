import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {listenForFetch,usableHttpPort} from '../testing/local-http.mjs';
test('local HTTP allocator rejects browser-blocked/low ports and closes them before retrying on loopback',async()=>{
  const ports=[6000,10080,24000],closed=[];
  const app={listen(port,host){assert.equal(usableHttpPort(port),true);assert.equal(host,'127.0.0.1');const assigned=ports.shift();const server=new EventEmitter();server.address=()=>({port:assigned});server.close=callback=>{closed.push(assigned);callback()};queueMicrotask(()=>server.emit('listening'));return server;}};
  assert.equal((await listenForFetch(app)).address().port,24000);assert.deepEqual(closed,[6000,10080]);
  for(const port of [0,6000,10080,16383,65536,NaN])assert.equal(usableHttpPort(port),false);
});
test('local HTTP allocation retries occupied ports and fails after a bounded number of attempts',async()=>{
  let attempts=0;
  const app={listen(port,host){assert(usableHttpPort(port));assert.equal(host,'127.0.0.1');attempts++;const server=new EventEmitter();queueMicrotask(()=>server.emit('error',Object.assign(new Error('occupied'),{code:'EADDRINUSE'})));return server;}};
  await assert.rejects(listenForFetch(app),/Unable to allocate/);assert.equal(attempts,50);
});
