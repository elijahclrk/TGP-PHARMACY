import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { createProductImagesRouter } from '../src/routes/product-images.routes.js';
import { normalizeProductImage, createImageProvider, imagePrefix, maxImageBytes } from '../src/services/product-images.js';
import { createProductImagesRepository } from '../src/repositories/product-images.repository.js';

const oldId = imagePrefix + '11111111-1111-4111-8111-111111111111';
const fixture = () => sharp({ create:{ width:2,height:2,channels:3,background:'#008000' } }).png().toBuffer();
async function setup(t, { enabled = true, limit = 100 } = {}) {
  let state = { image:null,audit:[] }, tail = Promise.resolve();
  const controls = { failAudit:false,commitLost:false,missing:false,uploads:[],deleted:[],uploadError:false,deleteError:false };
  const users = { 1:{user_id:1,role:'admin',status:'active'},2:{user_id:2,role:'manager',status:'active'},3:{user_id:3,role:'employee',status:'active'},4:{user_id:4,role:'manager',status:'inactive'} };
  const authRepository = {
    findById:async id => users[id],
    async transaction(work) {
      const before = tail;
      let release; tail = new Promise(resolve => { release = resolve; }); await before;
      const snapshot = structuredClone(state);
      try {
        const result = await work({});
        if (controls.commitLost && state.image !== snapshot.image) { controls.commitLost=false; throw Object.assign(new Error('Lost response'),{committed:true}); }
        return result;
      } catch (error) { if (!error.committed) state = snapshot; throw error; }
      finally { release(); }
    },
    audit:async (_client,_actor,action) => {
      if (controls.failAudit && action.includes('.saved:')) throw Error('synthetic audit failure');
      state.audit.push(action);
    },
  };
  const repository = {
    get:async id => { if (id!==1 || controls.missing) throw Object.assign(Error(),{status:404}); return { product_id:1,image_public_id:state.image }; },
    replace:async (_client,_id,expected,next) => { if (state.image!==expected) throw Object.assign(Error(),{status:409}); state.image=next; },
  };
  const provider = { enabled,url:id=>'https://res.cloudinary.com/test/image/upload/'+id,
    upload:async (_buffer,id) => { controls.uploads.push(id); if (controls.uploadError) throw Object.assign(Error('redacted'),{status:502}); await controls.onUpload?.(); },
    remove:async id=>{ controls.deleted.push(id); if (controls.deleteError) throw Error('redacted'); } };
  const config = { secure:false,origin:'http://localhost:5173' };
  const sessions = { verify:token=>users[token] ? {userId:Number(token),id:token} : null,revoke(){} };
  const app=express();app.use(express.json());app.use(cookieParser());
  app.use(createProductImagesRouter({config,sessions,authRepository,repository,provider,mutationLimit:limit}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  async function request({method='GET',user=1,body,origin=config.origin,id='1'}={}) {
    const headers={Origin:origin,'X-TGP-Request':'1',...(user?{Cookie:'tgp_session='+user}:{})};
    if (body && !(body instanceof FormData)) { headers['Content-Type']='application/json';body=JSON.stringify(body); }
    const res=await fetch(url+'/products/'+id+'/image',{method,headers,body});return {status:res.status,body:await res.json()};
  }
  async function upload({expected='',buffer,...rest}={}) {
    buffer ??= await fixture();
    const body=new FormData();body.append('expected_image',expected);body.append('image',new Blob([buffer]),'image.png');
    return request({method:'PUT',body,...rest});
  }
  return {request,upload,controls,users,state:()=>state,setImage:id=>{state.image=id;}};
}

test('image decoder rejects invalid content, oversize and excessive dimensions; strips metadata',async()=>{
  const jpeg=await sharp(await fixture()).withMetadata().jpeg().toBuffer();
  const normalized=await normalizeProductImage(jpeg);const meta=await sharp(normalized).metadata();
  assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);
  for(const b of [Buffer.from('<svg/>'),Buffer.from([255,216,255,0]),Buffer.alloc(maxImageBytes+1)]) await assert.rejects(()=>normalizeProductImage(b),{status:400});
  const wide=await sharp({create:{width:4097,height:1,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(()=>normalizeProductImage(wide),{status:400});
});
test('provider is opt-in and rejects unowned deletion targets without network',async()=>{
  const disabled=createImageProvider({});assert.equal(disabled.enabled,false);assert.equal(disabled.url(oldId),null);
  await assert.rejects(()=>disabled.remove(oldId),{status:503});
  const provider=createImageProvider({PRODUCT_IMAGES_ENABLED:'true',CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'fixture',CLOUDINARY_API_SECRET:'fixture'});
  assert.equal(provider.enabled,true);assert.match(provider.url(oldId),/^https:\/\/res\.cloudinary\.com\/test\//);
  await assert.rejects(()=>provider.remove('another-product'),{status:503});
});
test('Cloudinary SDK adapter fixes upload/deletion options and safely handles provider failures',async t=>{
  const provider=createImageProvider({PRODUCT_IMAGES_ENABLED:'true',CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'fixture',CLOUDINARY_API_SECRET:'fixture'});
  let fail=false;
  t.mock.method(cloudinary.uploader,'upload_stream',(options,callback)=>({end(buffer){
    assert(Buffer.isBuffer(buffer));assert.equal(options.public_id,oldId);assert.equal(options.overwrite,false);
    assert.equal(options.resource_type,'image');assert.equal(options.type,'upload');assert.equal(options.timeout,15000);
    callback(fail ? Error('provider detail must stay private') : null,{public_id:oldId,resource_type:'image'});
  }}));
  t.mock.method(cloudinary.uploader,'destroy',async(id,options)=>{
    assert.equal(id,oldId);assert.equal(options.invalidate,true);assert.equal(options.resource_type,'image');
    if(fail)throw Error('provider detail must stay private');return {result:'ok'};
  });
  await provider.upload(await fixture(),oldId);await provider.remove(oldId);
  fail=true;
  for(const operation of [()=>provider.upload(Buffer.from('fixture'),oldId),()=>provider.remove(oldId)]) {
    await assert.rejects(operation,error=>error.status===502 && !error.message.includes('private'));
  }
});
test('image API enforces authentication, active status, roles and trusted mutations',async t=>{
  const f=await setup(t);
  assert.equal((await f.request({user:null})).status,401);
  assert.equal((await f.request({user:4})).status,401);
  assert.equal((await f.request({user:3})).status,200);
  assert.equal((await f.upload({user:3})).status,403);
  assert.equal((await f.upload({origin:'http://untrusted.example'})).status,403);
  assert.equal(f.controls.uploads.length,0);
});
test('manager uploads, replaces and removes; audit and references reflect exactly one image',async t=>{
  const f=await setup(t);const first=await f.upload({user:2});assert.equal(first.status,200);
  const id=first.body.data.image.public_id;assert.equal(f.state().image,id);
  assert.equal((await f.request({user:3})).body.data.image.public_id,id);
  const next=await f.upload({expected:id});assert.equal(next.status,200);assert.notEqual(next.body.data.image.public_id,id);
  assert.deepEqual(f.controls.deleted,[id]);
  const removed=await f.request({method:'DELETE',body:{expected_image:next.body.data.image.public_id}});
  assert.equal(removed.status,200);assert.equal(f.state().image,null);assert.equal(removed.body.data.image,null);
  assert.equal(f.state().audit.filter(x=>x.includes('.saved:')).length,2);
  assert.equal(f.state().audit.filter(x=>x.includes('.removed:')).length,1);
});
test('missing products, unknown fields, multiple files and forged references are rejected',async t=>{
  const f=await setup(t);
  assert.equal((await f.upload({id:'2'})).status,404);
  assert.equal((await f.upload({id:'1 OR 1=1'})).status,400);
  assert.equal((await f.request({method:'DELETE',body:{expected_image:'',public_id:oldId}})).status,400);
  assert.equal((await f.upload({expected:'other-asset'})).status,400);
  assert.equal((await f.upload({buffer:Buffer.alloc(maxImageBytes+1)})).status,400);
  const body=new FormData();body.append('expected_image','');body.append('image',new Blob([await fixture()]),'a.png');body.append('image',new Blob([await fixture()]),'b.png');
  assert.equal((await f.request({method:'PUT',body})).status,400);assert.equal(f.controls.uploads.length,0);
});
test('provider failure keeps current reference and durable intent without exposing error details',async t=>{
  const f=await setup(t);f.setImage(oldId);f.controls.uploadError=true;
  const result=await f.upload({expected:oldId});assert.equal(result.status,502);assert.equal(f.state().image,oldId);
  assert(!JSON.stringify(result.body).includes('redacted'));assert(f.state().audit.some(x=>x.includes('upload_started')));
});
test('audit rollback preserves old image and compensates new upload',async t=>{
  const f=await setup(t);f.setImage(oldId);f.controls.failAudit=true;
  assert.equal((await f.upload({expected:oldId})).status,503);assert.equal(f.state().image,oldId);
  assert.deepEqual(f.controls.deleted,f.controls.uploads);assert(!f.state().audit.some(x=>x.includes('.saved:')));
});
test('lost COMMIT acknowledgement never deletes possibly committed image',async t=>{
  const f=await setup(t);f.controls.commitLost=true;
  assert.equal((await f.upload()).status,503);assert.equal(f.state().image,f.controls.uploads[0]);assert.deepEqual(f.controls.deleted,[]);
  assert.equal((await f.request()).body.data.image.public_id,f.state().image);
});
test('concurrent stale replacements cannot overwrite winning image',async t=>{
  const f=await setup(t);f.setImage(oldId);
  const results=await Promise.all([f.upload({expected:oldId}),f.upload({expected:oldId})]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  assert(!f.controls.deleted.includes(f.state().image));assert.equal(f.state().audit.filter(x=>x.includes('.saved:')).length,1);
});
test('global mutation capacity rejects a third upload while two provider calls are pending',async t=>{
  const f=await setup(t);let signal,release;
  const entered=new Promise(resolve=>{signal=resolve;});const hold=new Promise(resolve=>{release=resolve;});let count=0;
  f.controls.onUpload=async()=>{if(++count===2)signal();await hold;};
  const pending=[f.upload(),f.upload()];
  try { await entered;assert.equal((await f.upload()).status,503);assert.equal(f.controls.uploads.length,2); }
  finally { release();await Promise.all(pending); }
});
test('deactivation during upload rejects save and cleans up the new asset',async t=>{
  const f=await setup(t);f.controls.onUpload=()=>{f.users[2].status='inactive';};
  assert.equal((await f.upload({user:2})).status,403);assert.equal(f.state().image,null);assert.deepEqual(f.controls.deleted,f.controls.uploads);
});
test('cleanup failure reports follow-up without undoing committed mapping',async t=>{
  const f=await setup(t);f.setImage(oldId);f.controls.deleteError=true;
  const result=await f.upload({expected:oldId});assert.equal(result.status,200);assert.equal(result.body.data.cleanup_pending,true);
  assert.notEqual(f.state().image,oldId);
});
test('disabled feature preserves availability and per-user upload limit fails closed',async t=>{
  const f=await setup(t,{enabled:false});assert.equal((await f.request()).body.data.enabled,false);
  assert.equal((await f.upload()).status,503);assert.equal(f.controls.uploads.length,0);
  const limited=await setup(t,{limit:1});assert.equal((await limited.upload({buffer:Buffer.from('bad')})).status,400);
  assert.equal((await limited.upload()).status,429);
});
test('image repository parameterizes input, detects stale mappings and handles absent migration',async()=>{
  const calls=[];const client={query:async(sql,values)=>{calls.push({sql,values});return {rows:[{product_id:1,image_public_id:oldId}]};}};
  const repo=createProductImagesRepository(()=>client);
  await repo.replace(client,1,oldId,null);assert.deepEqual(calls[1].values,[1,null]);assert.match(calls[0].sql,/FOR UPDATE$/);
  await assert.rejects(()=>repo.replace(client,1,null,oldId),{status:409});
  const absent=createProductImagesRepository(()=>({query:async()=>{throw Object.assign(Error(),{code:'42703'});}}));
  await assert.rejects(()=>absent.get(1),{status:503});
});
