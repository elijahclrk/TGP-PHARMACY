import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {packagedWorkflowFixture,canonicalFiles} from './support/packaged-workflow-fixture.js';
test('Docker runtime allowlist packages exact workflow resources and PDF assets without migration runners or secrets',async()=>{
  const fixture=await packagedWorkflowFixture();
  try{
    assert.deepEqual((await readdir(fixture.resources)).sort(),canonicalFiles);
    for(const name of canonicalFiles)assert.deepEqual(await readFile(join(fixture.resources,name)),await readFile(new URL('../database/migrations/proposed/batch1/'+name,import.meta.url)));
    assert((await readFile(join(fixture.runtime,'src/assets/fonts/NotoSans.ttf'))).length>100000);
    assert((await readFile(join(fixture.runtime,'src/assets/fonts/OFL.txt'),'utf8')).includes('SIL OPEN FONT LICENSE'));
    assert.deepEqual((await readdir(fixture.runtime)).sort(),['database','package.json','src']);
    // A real copy of runtime code executes, and safely refuses absent schema.
    assert.equal(await fixture.createWorkflowsRepository(()=>({query:async()=>({rows:[]})})).schemaReady(),false);
  }finally{await fixture.dispose();}
});
