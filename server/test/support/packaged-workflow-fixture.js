// Mirrors the reviewed Docker runtime COPY allowlist. Host Node simulation,
// never a claim that a Linux Docker image was built or executed.
import {mkdtemp,mkdir,cp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

export const canonicalFiles=['007_decision_workflows.sql','008_return_dispositions.sql'];
export const extraCanonicalFiles=['batch7/010_in_app_notification_preferences.sql','batch13/012_local_product_exchanges.sql','batch14/013_operational_completion.sql'];
export async function packagedWorkflowFixture(){
  const docker=await readFile(new URL('../../../Dockerfile',import.meta.url),'utf8');
  const ignore=await readFile(new URL('../../../.dockerignore',import.meta.url),'utf8');
  for(const name of canonicalFiles){
    const source='server/database/migrations/proposed/batch1/'+name;
    assert(docker.includes(source),'Docker must explicitly copy '+name);
    assert(ignore.includes('!'+source),'Docker context must admit '+name);
  }
  for(const directory of ['server/database/','server/database/migrations/','server/database/migrations/proposed/','server/database/migrations/proposed/batch1/'])assert(ignore.split(/\r?\n/).includes('!'+directory));
  assert(docker.includes('server/src ./src'));assert(!/COPY[^\n]*server\/\.env/.test(docker));
  const root=await mkdtemp(join(tmpdir(),'tgp-package-'));
  const runtime=join(root,'server'),resources=join(runtime,'database','migrations','proposed','batch1');
  try{
    await mkdir(resources,{recursive:true});
    await cp(new URL('../../src/',import.meta.url),join(runtime,'src'),{recursive:true});
    await cp(new URL('../../package.json',import.meta.url),join(runtime,'package.json'));
    for(const name of canonicalFiles)await cp(new URL('../../database/migrations/proposed/batch1/'+name,import.meta.url),join(resources,name));
    for(const name of extraCanonicalFiles){const source='server/database/migrations/proposed/'+name;assert(docker.includes(source));assert(ignore.split(/\r?\n/).includes('!'+source));const target=join(runtime,'database/migrations/proposed',name);await mkdir(resolve(target,'..'),{recursive:true});await cp(new URL('../../database/migrations/proposed/'+name,import.meta.url),target);assert.deepEqual(await readFile(target),await readFile(new URL('../../database/migrations/proposed/'+name,import.meta.url)));}
    const module=await import(pathToFileURL(join(runtime,'src','repositories','workflows.repository.js')).href);
    return {root,runtime,resources,...module,dispose:()=>dispose(root)};
  }catch(error){await dispose(root);throw error;}
}
async function dispose(root){
  assert(resolve(root).startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('tgp-package-'));
  await rm(root,{recursive:true,force:true});
}
