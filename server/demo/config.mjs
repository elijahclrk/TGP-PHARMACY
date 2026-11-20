import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';

export const demoFile = new URL('../.env.demo',import.meta.url);
export const marker = 'TGP_ISOLATED_ACADEMIC_DEMO_V1';
export const origin = 'http://127.0.0.1:5174';
export const refuse = label => { throw new Error(label); };

function identity(raw) {
  let url;
  try { url=new URL(raw); } catch { refuse('INVALID_DATABASE_URL'); }
  if (!['postgres:','postgresql:'].includes(url.protocol) || !url.hostname || url.hash) refuse('INVALID_DATABASE_URL');
  const database=decodeURIComponent(url.pathname.slice(1));
  // pg URL options must not redirect the connection or override search_path.
  if ([...url.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))) refuse('UNSUPPORTED_DATABASE_URL_OPTIONS');
  const host=url.hostname.toLowerCase().replace(/-pooler(?=\.)/,'');
  return { database, host, port:url.port || '5432' };
}

export function validateDemoConfig(input, protectedURLs = []) {
  if (input.DEMO_ISOLATION_CONFIRMED !== 'true') refuse('ISOLATION_NOT_CONFIRMED');
  if (!input.DEMO_DATABASE_URL) refuse('DEMO_DATABASE_URL_REQUIRED');
  const id=identity(input.DEMO_DATABASE_URL);
  if (!/^tgp_demo_[a-z0-9_]+$/.test(id.database)) refuse('DEDICATED_DEMO_DATABASE_NAME_REQUIRED');
  for (const raw of protectedURLs.filter(Boolean)) {
    // Parse protected connection identity without rejecting its unrelated options.
    let live; try { live=new URL(raw); } catch { refuse('PROTECTED_CONNECTION_INVALID'); }
    const liveHost=live.hostname.toLowerCase().replace(/-pooler(?=\.)/,'');
    const liveDatabase=decodeURIComponent(live.pathname.slice(1));
    if (id.database===liveDatabase || (id.host===liveHost && id.port===(live.port || '5432') && id.database===liveDatabase)) refuse('PROTECTED_DATABASE_REFUSED');
  }
  if (!input.DEMO_JWT_SECRET || Buffer.byteLength(input.DEMO_JWT_SECRET)<48) refuse('DEMO_SIGNING_SECRET_REQUIRED');
  for (const role of ['ADMIN','MANAGER','EMPLOYEE']) {
    const name=input[`DEMO_${role}_USERNAME`],password=input[`DEMO_${role}_PASSWORD`];
    if (!/^demo_[a-z0-9_]{1,55}$/.test(name || '') || !password || password.length<20 || password.length>128) refuse('INVALID_DEMO_ACCOUNT_CONFIGURATION');
  }
  if (new Set(['ADMIN','MANAGER','EMPLOYEE'].map(r=>input[`DEMO_${r}_USERNAME`])).size!==3 ||
      new Set(['ADMIN','MANAGER','EMPLOYEE'].map(r=>input[`DEMO_${r}_PASSWORD`])).size!==3) refuse('DISTINCT_DEMO_ACCOUNTS_REQUIRED');
  return Object.freeze({ values:input,database:id.database,
    fingerprint:createHash('sha256').update(JSON.stringify(id)).digest('hex') });
}

export async function loadDemoConfig() {
  let input;
  try { input=parse(await readFile(demoFile)); } catch { refuse('DEMO_CONFIG_FILE_REQUIRED'); }
  let live={};
  try { live=parse(await readFile(new URL('../.env',import.meta.url))); }
  catch(error) { if(error.code!=='ENOENT')refuse('PROTECTED_CONFIG_UNREADABLE'); }
  return validateDemoConfig(input,[live.DATABASE_URL,process.env.DATABASE_URL]);
}

export function activateDemo(config) {
  // Must run before importing app/config modules. dotenv never overrides these.
  Object.assign(process.env,{DATABASE_URL:config.values.DEMO_DATABASE_URL,JWT_SECRET:config.values.DEMO_JWT_SECRET,
    NODE_ENV:'development',PORT:'5001',CLIENT_ORIGIN:origin,JWT_TTL_SECONDS:'900',
    PRODUCT_IMAGES_ENABLED:'false',PGOPTIONS:'-c timezone=UTC',TZ:'UTC'});
}

export async function configureDemo() {
  // Refuse to generate credentials unless Git already excludes this exact file.
  try { execFileSync('git',['check-ignore','--quiet','server/.env.demo'],{cwd:new URL('../../',import.meta.url),stdio:'ignore'}); }
  catch { refuse('DEMO_CONFIG_MUST_BE_GIT_IGNORED'); }
  const values={DEMO_DATABASE_URL:'',DEMO_ISOLATION_CONFIRMED:'false',DEMO_JWT_SECRET:randomBytes(48).toString('hex')};
  for(const role of ['ADMIN','MANAGER','EMPLOYEE']) {
    values[`DEMO_${role}_USERNAME`]='demo_'+role.toLowerCase();
    values[`DEMO_${role}_PASSWORD`]=randomBytes(24).toString('base64url');
  }
  try {
    await writeFile(demoFile,'# LOCAL SECRETS. Do not publish, screenshot, or copy into production.\n'+
      Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{flag:'wx',mode:0o600});
  } catch(error) { refuse(error.code==='EEXIST'?'DEMO_CONFIG_ALREADY_EXISTS':'DEMO_CONFIG_CREATION_FAILED'); }
  console.log('Created ignored server/.env.demo with random credentials. No database connected. Supply only a new isolated database URL and confirm isolation in that file.');
}
