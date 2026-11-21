// Local synthetic demo facade. No production URL, SQL/reset or credential input.
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export function demoPlan(args){
  const [action,root]=args;
  if(args.length!==2||!['verify','reset','start'].includes(action)||typeof root!=='string'||!root.trim()||root.includes('://'))throw new Error('Use local-demo.mjs verify|reset|start followed by the attested local instance directory.');
  const plan=[['local-postgres.mjs','verify',root]];
  // Reset is a NEW owned schema + deterministic synthetic seed + browser checks.
  // It never deletes/reseeds an existing schema or overwrites retained evidence.
  if(action!=='verify')plan.push(['batch4-uat.mjs',root,'--built-client',...(action==='start'?['--review']:[])]);
  return plan;
}
export async function runDemo(args,execute=runChild){for(const command of demoPlan(args))await execute(command);}
export async function withProductionFrontend(work){
  const previous=process.env.NODE_ENV;
  try{process.env.NODE_ENV='production';return await work();}
  finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
}
function runChild([script,...args]){
  return new Promise((accept,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL('./'+script,import.meta.url)),...args],{
      cwd:fileURLToPath(new URL('../',import.meta.url)),windowsHide:true,shell:false,stdio:'inherit',
      env:{...process.env,DATABASE_URL:'postgresql://blocked:synthetic@production.invalid/never_connect'},
    });
    child.once('error',()=>reject(new Error('Local demo could not start.')));
    child.once('exit',code=>code===0?accept():reject(new Error('Local demo refused or failed; review redacted local guard/test evidence.')));
  });
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{await runDemo(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
}
