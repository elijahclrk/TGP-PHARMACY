import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoPlan,runDemo,withProductionFrontend} from '../testing/local-demo.mjs';
test('demo facade refuses unsupported actions, URLs and extra switches without invoking any process',()=>{
  for(const args of [[],['start'],['seed','local'],['start','postgresql://never-use'],['reset','local','--production'],['start','']])assert.throws(()=>demoPlan(args));
});
test('fresh-schema reset preserves prior runs and requests compiled frontend verification without a destructive reset command',()=>{
  const flags=['--built-client','--benefits','--exchanges','--operations','--demo'];
  assert.deepEqual(demoPlan(['reset','local-root']),[['local-postgres.mjs','verify','local-root'],['batch4-uat.mjs','local-root',...flags]]);
  assert.deepEqual(demoPlan(['start','local-root'])[1],['batch4-uat.mjs','local-root',...flags,'--review']);
});
test('failed isolation preflight stops before any demo fixture/build runner starts',async()=>{
  const commands=[];await assert.rejects(runDemo(['reset','local-root'],async command=>{commands.push(command);throw new Error('refused')}));assert.equal(commands.length,1);assert.equal(commands[0][0],'local-postgres.mjs');
});
test('production frontend build cannot inherit server development mode and restores it after success or failure',async()=>{
  const previous=process.env.NODE_ENV;
  try{
    process.env.NODE_ENV='development';
    await withProductionFrontend(async()=>assert.equal(process.env.NODE_ENV,'production'));assert.equal(process.env.NODE_ENV,'development');
    await assert.rejects(withProductionFrontend(async()=>{assert.equal(process.env.NODE_ENV,'production');throw new Error('fixture build failure')}));assert.equal(process.env.NODE_ENV,'development');
  }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
