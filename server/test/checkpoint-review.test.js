import {test} from 'node:test';
import assert from 'node:assert/strict';
import {permittedCheckpointPath,secretKinds} from '../testing/review-checkpoint.mjs';
test('checkpoint excludes local credentials, private databases and generated artifacts without reading their content',()=>{
 for(const p of ['server/.env','server/.env.example','private-uat.json','server/tmp/tgp_uat_test/a','certificate.crt','private.key','test-results/report.html','academic_credentials/account','client/dist/index.html','dump.backup'])assert.equal(permittedCheckpointPath(p),false,p);
 for(const p of ['server/testing/batch15-browser.mjs','docs/phase4/BATCH15_RESULTS.md','server/database/migrations/proposed/batch14/013_operational_completion.sql'])assert.equal(permittedCheckpointPath(p),true,p);
});
test('checkpoint recognizes sensitive marker families but permits the explicit unusable production sentinel',()=>{
 assert.deepEqual(secretKinds('postgresql://blocked:synthetic@production.invalid/never_connect'),[]);
 assert(secretKinds('postgresql://'+'some_user:private_value@unapproved.example/database').includes('credential-url'));
 assert(secretKinds('-----BEGIN '+'PRIVATE KEY-----').includes('private-key'));
 assert(secretKinds('ghp_'+'x'.repeat(36)).includes('github-token'));
});
