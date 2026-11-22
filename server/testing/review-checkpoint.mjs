// Local review artifacts only. Never stages, commits, pushes, loads .env or uses DB.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='d4c289edabb553ed54dfde507dc84af479cc99d8';
const manifestPath='docs/phase4/BATCH15_CHECKPOINT_MANIFEST.json',listPath='docs/phase4/BATCH15_CHECKPOINT_FILES.md';
const message='feat: checkpoint local exchanges, operational completion and MVP handoff';
const git=(...args)=>execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function permittedCheckpointPath(path){return !/(^|\/)(?:\.env(?:\..*)?|private(?:-uat)?\.json|credentials\.json|service-account[^/]*|node_modules|dist|coverage|test-results|playwright-report|tgp-pg-[^/]*|tgp_uat_[^/]*|\.ssh|\.aws)(\/|$)|\.(?:key|pem|crt|p12|pfx|crl|csr|log|png|pdf|xlsx|zip|dump|backup)$/i.test(path)&&!/(^|\/)(?:academic[-_]?credentials|passwords?\.txt)(\/|$)/i.test(path);}
export function secretKinds(text){const checks=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['github-token',/(?:github_pat_[A-Za-z0-9_]{40,}|ghp_[A-Za-z0-9]{30,})/],['provider-token',/(?:xox[baprs]-[A-Za-z0-9-]{20,}|sk-proj-[A-Za-z0-9_-]{30,})/],['aws-access-key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],['credential-url',/postgres(?:ql)?:\/\/[^\s'"`]+:[^\s'"`]+@(?!(?:production|remote|example)\.invalid\b|127\.0\.0\.1\b|localhost\b)[^\s'"`]+/i]];return checks.filter(([,re])=>re.test(text)).map(([kind])=>kind);}
async function inventory(){
 assert.equal(git('rev-parse','HEAD'),base,'Unexpected HEAD; re-review baseline');assert.equal(git('branch','--show-current'),'main');assert.equal(git('diff','--cached','--name-only'),'','Index must remain empty');assert.equal(git('diff','--name-only','--diff-filter=D','HEAD'),'','Review deletions explicitly');
 const tracked=git('diff','--name-only','HEAD').split('\n').filter(Boolean),untracked=git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean),paths=[...new Set([...tracked,...untracked])].sort();
 const protectedHistory=JSON.parse(await readFile(resolve(root,'docs/phase4/BATCH11_CHECKPOINT_MANIFEST.json'),'utf8')).protectedAppliedMigrations;
 for(const entry of protectedHistory)assert.equal(hash(await readFile(resolve(root,entry.path))),entry.sha256,'Protected migration mismatch: '+entry.path);
 const files=[];for(const path of paths){assert(permittedCheckpointPath(path),'Sensitive/unexplained path: '+path);const bytes=await readFile(resolve(root,path));assert(!bytes.includes(0),'Unexpected binary review content: '+path);const kinds=secretKinds(bytes.toString());assert.equal(kinds.length,0,'Unexplained sensitive content: '+path+' ('+kinds.join(',')+')');files.push({path,status:tracked.includes(path)?'modified':'new',sha256:path===manifestPath?null:hash(bytes)});}
 return {schemaVersion:1,projectDate:'2026-11-22',timezone:'Asia/Manila',purpose:'Owner review pending; nothing staged, committed, pushed or deployed',branch:'main',baseHead:base,proposedCommitMessage:message,pathCount:files.length,modifiedTracked:tracked.length,newUntracked:untracked.length,hashConvention:'SHA-256 of raw working-tree bytes, before Git LF/CRLF normalization. Manifest self-entry intentionally has null hash; verify all other files plus exact path set.',protectedAppliedMigrations:protectedHistory,scan:{pathsReviewed:files.length,forbiddenPaths:0,unexplainedSecretPatterns:0,scope:'Current modified and nonignored untracked candidate files only; ignored environment/private originals are not read. Synthetic fixture recipes remain source, generated records/artifacts excluded. Manual contextual review is recorded in BATCH15_RESULTS.md; no certification implied.'},files};
}
export async function checkpoint(action){
 assert(['--write','--verify'].includes(action),'Use --write or --verify only');
 if(action==='--write'){
  // Include both review artifacts in the exact inventory. Existing report must
  // already be final before writing; subsequent edits require refresh/review.
  let current=await inventory();
  const required=[manifestPath,listPath,'docs/phase4/BATCH15_RESULTS.md'];for(const path of required)assert(current.files.some(f=>f.path===path),'Review artifact missing: '+path);
  const b=String.fromCharCode(96),rows=current.files.map(f=>'| '+(f.status==='new'?'New':'Modified')+' | '+b+f.path+b+' |').join('\n');
  await writeFile(resolve(root,listPath),'# Batch 15 — exact proposed local checkpoint\n\nOwner approval pending. Nothing staged or committed. Base: '+b+base+b+' on main.\n\n**'+current.pathCount+' paths: '+current.modifiedTracked+' modified tracked, '+current.newUntracked+' new.** Accumulated Batches 12–15 only.\n\nProposed subject: '+b+message+b+'.\n\nThe companion SHA-256 manifest covers raw working-tree bytes; Git may normalize line endings. Its self-entry is intentionally unhashed. Any changed content or extra/missing path invalidates this reviewed inventory. See BATCH15_RESULTS.md for scan findings, exclusions and unresolved release gates. This list authorizes no staging, commit, push, migration or activation.\n\nExcluded: environment/academic credentials, original private request PDF, real identities, temporary PostgreSQL data, private manifests, keys/certificates and generated browser/build/export artifacts. Explicit synthetic fixture recipes are intentional source.\n\n| Status | Reviewed path |\n|---|---|\n'+rows+'\n');
  current=await inventory();await writeFile(resolve(root,manifestPath),JSON.stringify(current,null,2)+'\n');
 }else{
  const recorded=JSON.parse(await readFile(resolve(root,manifestPath),'utf8')),current=await inventory();assert.deepEqual(current,recorded,'Checkpoint manifest or exact working-tree set changed; stop and re-review');
 }
 const recorded=JSON.parse(await readFile(resolve(root,manifestPath),'utf8'));console.log(JSON.stringify({checkpointReview:action,pathCount:recorded.pathCount,modifiedTracked:recorded.modifiedTracked,newUntracked:recorded.newUntracked,protectedMigrationsUnchanged:true,staged:0,productionAccess:false}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){assert.equal(process.argv.length,3,'One explicit review action required');await checkpoint(process.argv[2]);}
