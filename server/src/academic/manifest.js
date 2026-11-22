import {createPublicKey, sign, verify} from 'node:crypto';
import {isIP} from 'node:net';

export const NOTICE='ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS';
export const canonical=value=>JSON.stringify(sort(value));
function sort(value){return Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])])):value;}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function refuse(){throw Object.assign(new Error('ACADEMIC_DEMO_REFUSED'),{status:503});}
const exactAcademicRoles=Object.freeze(['tgp_academic_runtime','tgp_academic_runtime_sql']);
export const academicOperatorMatches=(runtimeRole,operatorRole)=>!exactAcademicRoles.includes(runtimeRole)||operatorRole==='tgp_academic_operator';
// Shared identity/URL checks; inspection may use these without issuing a signed
// authorization or acquiring a runtime capability.
export function validateAcademicTarget(p){
 if(p?.managedPostgresDigest!==undefined&&(p.database!=='tgp_demo_academic_web'||p.role!=='tgp_academic_runtime_sql'||typeof p.managedPostgresDigest!=='string'||!/^[a-f0-9]{64}$/.test(p.managedPostgresDigest)))refuse();
 if(!p||!/^tgp_demo_[a-z0-9_]+$/.test(p.database)||!(exactAcademicRoles.includes(p.role)||/^demo_runtime_[a-z0-9_]+$/.test(p.role))||p.schema!=='public'||!/^[-a-z0-9]{5,100}$/.test(p.projectId))refuse();
 if(!Array.isArray(p.hosts)||!p.hosts.length||p.hosts.length>2||new Set(p.hosts).size!==p.hosts.length||p.hosts.some(h=>!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(h)))refuse();
 const normalized=p.hosts.map(h=>h.replace('-pooler.','.'));if(normalized.some(h=>h!==normalized[0]))refuse();
}
export function academicTargetUrl(value,p){
 let url;try{url=new URL(value);}catch{refuse();}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!p.hosts.includes(url.hostname)||decodeURIComponent(url.pathname.slice(1))!==p.database||decodeURIComponent(url.username)!==p.role||!url.password||url.hash||(url.port&&url.port!=='5432')||[...url.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k)))refuse();
 return url;
}
export function requireAcademicOrigin(value){
 let origin;try{origin=new URL(value);}catch{refuse();}
 if(origin.protocol!=='https:'||origin.origin!==value||origin.username||origin.password)refuse();
 return origin;
}
export function signManifest(payload,key){return {payload,signature:sign(null,Buffer.from(canonical(payload)),key).toString('base64')};}
export function readManifest(encoded,publicKey,now=Date.now()){
 try{
  if(typeof encoded!=='string'||encoded.length>32768)refuse();
  const document=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
  const key=createPublicKey(Buffer.from(publicKey,'base64').toString('utf8'));
  if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(canonical(document.payload)),key,Buffer.from(document.signature,'base64')))refuse();
  const p=document.payload;
  if(Object.keys(p).filter(k=>k!=='managedPostgresDigest').sort().join(',')!==['protocol','phase','demoId','projectId','hosts','database','role','schema','issuedAt','expiresAt','migrationDigest','schemaDigest','seedId','exchangePolicy'].sort().join(','))refuse();
  if(!['setup','ready'].includes(p.phase))refuse();
  if(p.protocol!=='tgp-academic-cloud-v1'||!/^[a-f0-9-]{36}$/.test(p.demoId)||!/^[a-f0-9-]{36}$/.test(p.seedId))refuse();
  validateAcademicTarget(p);
  const start=Date.parse(p.issuedAt),end=Date.parse(p.expiresAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||end-start>7*86400000||!/^[a-f0-9]{64}$/.test(p.migrationDigest)||!/^[a-f0-9]{64}$/.test(p.schemaDigest))refuse();
  if(p.exchangePolicy?.testOnly!==true||!Array.isArray(p.exchangePolicy.pairs)||!p.exchangePolicy.pairs.length||!p.exchangePolicy.version||!Number.isFinite(Date.parse(p.exchangePolicy.validUntil))||Date.parse(p.exchangePolicy.validUntil)>end||Date.parse(p.exchangePolicy.validUntil)<=now||p.exchangePolicy.pairs.some(r=>![r.sourceProductId,r.replacementProductId,r.authorizationId].every(n=>Number.isInteger(n)&&n>0&&n<=2147483647)||!r.version||!r.evidence?.startsWith('SYNTHETIC')||r.prescriptionRequired!==false||!Number.isFinite(Date.parse(r.validUntil))||Date.parse(r.validUntil)>end||Date.parse(r.validUntil)<=now))refuse();
  return freeze(document);
 }catch{refuse();}
}
export function readAcademicConfig(settings,now=Date.now(),{operatorSetup=false}={}){
 if(settings.ACADEMIC_DEMO_ENABLED!=='true'||settings.NODE_ENV!=='production'||settings.NODE_TLS_REJECT_UNAUTHORIZED==='0'||settings.DATABASE_URL||settings.TEST_DATABASE_URL||settings.CONTROLLED_WORKFLOWS_ENABLED==='true'||settings.RETURN_RESTOCK_ENABLED==='true'||settings.PRODUCT_IMAGES_ENABLED==='true')refuse();
 const document=readManifest(settings.ACADEMIC_DEMO_MANIFEST_B64,settings.ACADEMIC_DEMO_PUBLIC_KEY_B64,now),p=document.payload;
 if(p.phase!=='ready'&&!operatorSetup)refuse();
 const url=academicTargetUrl(settings.ACADEMIC_DEMO_DATABASE_URL,p),origin=requireAcademicOrigin(settings.CLIENT_ORIGIN);
 if(!settings.JWT_SECRET||Buffer.byteLength(settings.JWT_SECRET)<48)refuse();
 const port=Number(settings.PORT),ttl=Number(settings.JWT_TTL_SECONDS??900),max=Number(settings.ACADEMIC_DEMO_POOL_MAX??3);
 if(!Number.isInteger(port)||port<1||port>65535||!Number.isInteger(ttl)||ttl<60||ttl>3600||!Number.isInteger(max)||max<1||max>3)refuse();
 const proxies=(settings.ACADEMIC_DEMO_TRUSTED_PROXY_CIDRS||'').split(',').filter(Boolean);
 if(proxies.length>8||proxies.some(c=>{const[ip,bits]=c.split('/');const v=isIP(ip);return !v||!/^\d+$/.test(bits||'')||Number(bits)<1||Number(bits)>(v===4?32:128);}))refuse();
 return Object.freeze({document,publicKey:settings.ACADEMIC_DEMO_PUBLIC_KEY_B64,url:url.toString(),origin:origin.origin,port,ttl,max,secret:settings.JWT_SECRET,proxies:Object.freeze(proxies)});
}
