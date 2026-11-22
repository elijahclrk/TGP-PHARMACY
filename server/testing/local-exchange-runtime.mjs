// Explicit local construction only. Never imported by the production entrypoint.
import assert from 'node:assert/strict';
import {disposableConfig,verifyDisposableClient} from '../test/support/disposable-database.js';
import {createExchangesRepository} from '../src/repositories/exchanges.repository.js';
export async function verifiedLocalExchanges(provider,settings,secret,policy){
 const target=new URL(settings.TEST_DATABASE_URL);
 assert.equal(target.hostname,'127.0.0.1');assert(target.port&&target.port!=='5432');
 assert(target.pathname.startsWith('/tgp_disposable_'));assert.equal(settings.DATABASE_URL,settings.TEST_DATABASE_URL);
 assert.notEqual(settings.NODE_ENV,'production');assert(policy.testOnly===true&&Array.isArray(policy.pairs));
 assert(Number.isFinite(Date.parse(policy.validUntil))&&policy.pairs.every(r=>Number.isFinite(Date.parse(r.validUntil))));
 const approved=disposableConfig(settings,'postgres://blocked:synthetic@production.invalid/never_connect');
 const verified=()=>({async connect(){const c=await provider().connect();try{await verifyDisposableClient(c,approved);assert.equal((await c.query('SHOW listen_addresses')).rows[0].listen_addresses,'127.0.0.1');return c;}catch(e){c.release();throw e;}},async query(...args){const c=await this.connect();try{return await c.query(...args);}finally{c.release();}}});
 const c=await verified().connect();c.release();
 return createExchangesRepository({poolProvider:verified,secret,policy:structuredClone(policy),isolatedCapability:Object.freeze({localOnly:true,tlsVerified:true})});
}
