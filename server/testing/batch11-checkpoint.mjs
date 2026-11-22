// Offline inventory and redacted pattern scan only. Never stages/commits,
// connects to a database, loads .env, or emits matched values.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
const list=(...args)=>git(...args).split('\0').filter(Boolean);
const tracked=list('ls-files','-z'),changed=list('diff','--name-only','-z','HEAD'),untracked=list('ls-files','--others','--exclude-standard','-z');
const candidates=[...new Set([...changed,...untracked])].sort();
const forbidden=p=>/(^|\/)(?:\.env(?:\..*)?|private(?:-uat)?\.json|credentials\.json|node_modules|dist|coverage|tmp|temp|data|chrome-profile|screenshots|downloads)(\/|$)/i.test(p)&&!p.endsWith('/.env.example')||/\.(?:pem|key|crt|p12|pfx|log|dump|backup)$/i.test(p);
const textFile=p=>/\.(?:js|jsx|mjs|json|md|sql|yml|yaml|txt|html|css|conf|example)$/i.test(p)||['.gitignore','.dockerignore','Dockerfile'].includes(p);
const findings=[],inventory=[],binary=[];let scannedTextFiles=0;
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['provider-token',/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{20,})\b/g],
 ['jwt-literal',/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/g],
 ['connection-url',/\b(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s'"`<>]+/gi],
 ['credential-literal',/\b(?:password|passwd|secret|token|api[_-]?key|jwt_secret|database_url)\s*[:=]\s*['"]([^'"\r\n]{8,})['"]/gi],
 ['email',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
 ['philippine-mobile',/(?<!\d)(?:\+63|09)\d(?:[\d -]{8,12})(?!\d)/g],
];
for(const path of [...new Set([...tracked,...untracked])].sort()){
 if(forbidden(path)){findings.push({path,line:0,rule:tracked.includes(path)?'forbidden-tracked-path':'forbidden-candidate-path',classification:'BLOCKED',inCheckpoint:candidates.includes(path)});continue;}
 const stat=await lstat(resolve(root,path));if(!stat.isFile()){findings.push({path,line:0,rule:'nonregular-path',classification:'REVIEW'});continue;}
 const bytes=await readFile(resolve(root,path)),isCandidate=candidates.includes(path);
 if(isCandidate)inventory.push({path,status:untracked.includes(path)?'new':'modified',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 if(!textFile(path)){if(isCandidate)binary.push({path,bytes:bytes.length,classification:'REVIEW_BINARY'});continue;}
 const source=bytes.toString('utf8');scannedTextFiles++;
 for(const[rule,pattern]of patterns)for(const match of source.matchAll(pattern)){
  const value=match[0],line=source.slice(0,match.index).split('\n').length;
  const fixture=/(?:^|\/)(?:test|testing|demo)\//.test(path)||/\.test\./.test(path);
  const near=source.slice(Math.max(0,match.index-180),match.index+value.length+180);
  const placeholder=/synthetic|fixture|example|localhost|127\.0\.0\.1|production\.invalid|protected\.invalid|blocked\.invalid|never_connect|change[-_ ]?me|test[-_ ]?only|invalid\/|\$\{|\.\.\.|<[^>]+>|\.repeat\(/i.test(value);
  const codeNotLiteral=/process\.env|randomBytes|sign\(|params\.|req\.|password_hash|length|maxLength|\(\?:|\\/.test(value);
  let classification=placeholder?'PLACEHOLDER':fixture&&(codeNotLiteral||/test|fixture|synthetic|not-login|expired|revoked/i.test(near))?'SYNTHETIC_FIXTURE':codeNotLiteral?'CODE_PATTERN':'REVIEW';
  const lineText=source.split(/\r?\n/)[line-1];
  if(rule==='philippine-mobile'&&/[a-f0-9]{64}/i.test(lineText)&&/hash|sha256/i.test(lineText))classification='FILE_CHECKSUM';
  if(['private-key','provider-token','jwt-literal'].includes(rule))classification='BLOCKED';
  findings.push({path,line,rule,classification,inCheckpoint:isCandidate});
 }
}
const protectedFiles=['001_phase3_baseline.sql','proposed/002_supported_integrity.sql','proposed/004_lookup_indexes.sql'];
const migrations=[];for(const file of protectedFiles){const path='server/database/migrations/'+file,bytes=await readFile(resolve(root,path)),head=execFileSync('git',['show','HEAD:'+path],{cwd:root,maxBuffer:1024*1024,windowsHide:true});migrations.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),sameAsHEAD:bytes.equals(head)});}
const report={head:git('rev-parse','HEAD').trim(),branch:git('branch','--show-current').trim(),staged:list('diff','--cached','--name-only','-z'),trackedCount:tracked.length,scannedTextFiles,candidateCount:inventory.length,files:inventory,binary,findings,migrations,limits:'Offline pattern review, not proof of absence. No ignored environment/private files are opened. Existing unchanged binaries are not OCR-scanned. Synthetic fixture source is not generated customer data. Manual review and owner approval required; no staging or commit.'};
if(process.argv[2]){const output=resolve(root,process.argv[2]),within=relative(root,output).replaceAll('\\','/');if(within.startsWith('..')||!within.startsWith('tmp/'))throw Error('Report output must be an ignored repository tmp path');await writeFile(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({head:report.head,branch:report.branch,staged:report.staged,trackedCount:report.trackedCount,scannedTextFiles,candidateCount:inventory.length,binary,findings:findings.filter(f=>['REVIEW','BLOCKED'].includes(f.classification)),findingCounts:findings.reduce((a,f)=>(a[f.classification]=(a[f.classification]??0)+1,a),{}),migrations,limits:report.limits},null,2));
