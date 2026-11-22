import assert from 'node:assert/strict';
import {disposableConfig,verifyDisposableClient} from '../test/support/disposable-database.js';
import {createOperationsRepository} from '../src/repositories/operations.repository.js';
export async function verifiedLocalOperations(provider,settings){
 const url=new URL(settings.TEST_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert(url.port&&url.port!=='5432');assert(url.pathname.startsWith('/tgp_disposable_'));assert.equal(settings.DATABASE_URL,settings.TEST_DATABASE_URL);assert.notEqual(settings.NODE_ENV,'production');
 const approved=disposableConfig(settings,'postgres://blocked:synthetic@production.invalid/never_connect');
 const verified=()=>({async connect(){const c=await provider().connect();try{await verifyDisposableClient(c,approved);assert.equal((await c.query('SHOW listen_addresses')).rows[0].listen_addresses,'127.0.0.1');return c;}catch(e){c.release();throw e;}},async query(...args){const c=await this.connect();try{return await c.query(...args);}finally{c.release();}}});
 const c=await verified().connect();c.release();return createOperationsRepository(verified,{localOnly:true,tlsVerified:true});
}
