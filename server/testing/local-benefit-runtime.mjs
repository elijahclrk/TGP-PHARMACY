// This module is never imported by the production application. URL refusal
// happens BEFORE connecting; all subsequent checks are read-only.
import assert from 'node:assert/strict';
import {disposableConfig,verifyDisposableClient} from '../test/support/disposable-database.js';
import {createLocalBenefitsRepository} from '../src/repositories/local-benefits.repository.js';
import {createPosRepository} from '../src/repositories/pos.repository.js';
export async function verifiedLocalBenefits(poolProvider,settings,secret){
 const target=new URL(settings.TEST_DATABASE_URL);
 assert.equal(target.hostname,'127.0.0.1');assert.notEqual(target.port,'5432');
 assert(target.pathname.startsWith('/tgp_disposable_'));
 assert.equal(settings.DATABASE_URL,settings.TEST_DATABASE_URL);
 assert.notEqual(settings.NODE_ENV,'production');
 const approved=disposableConfig(settings,'postgres://blocked:synthetic@production.invalid/never_connect');
 const c=await poolProvider().connect();
 try{await verifyDisposableClient(c,approved);assert.equal((await c.query('SHOW listen_addresses')).rows[0].listen_addresses,'127.0.0.1');}
 finally{c.release();}
 return createLocalBenefitsRepository({poolProvider,posRepository:createPosRepository(poolProvider),secret,isolatedCapability:Object.freeze({localOnly:true,tlsVerified:true})});
}
