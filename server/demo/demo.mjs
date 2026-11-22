import { loadDemoConfig, configureDemo, activateDemo, origin } from './config.mjs';
import { initializeDemo, demoPool, verifySchema } from './database.mjs';

const mode=process.argv[2];
try {
  if(process.argv.length!==3 || !['config','init','seed','verify','start'].includes(mode))throw Error('INVALID_DEMO_COMMAND');
  if(mode==='config')await configureDemo();
  else {
    const config=await loadDemoConfig();
    // No application module or database pool is loaded until isolation passes.
    activateDemo(config);
    if(mode==='init')console.log(await initializeDemo(config));
    else if(mode==='seed' || mode==='verify') {
      const {runWorkflows}=await import('./workflows.mjs');
      const result=await runWorkflows(config,{seed:mode==='seed'});
      console.log(JSON.stringify({isolatedDemo:true,mode,...result}));
    } else {
      const pool=await demoPool(config);let client;
      try {client=await pool.connect();await verifySchema(client,config);}
      finally {client?.release();await pool.end();}
      const {default:app}=await import('../src/app.js');
      const {closePool}=await import('../src/config/database.js');
      const server=app.listen(5001,'127.0.0.1',()=>console.log('Isolated demo API: http://127.0.0.1:5001; open frontend at '+origin+'. Images disabled.'));
      server.on('error',()=>{console.error('Demo API could not bind port 5001.');process.exitCode=1;});
      const shutdown=()=>server.close(async()=>{await closePool();process.exitCode=0;});
      process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
    }
  }
} catch(error) {
  // Never echo untrusted pg/URL errors, credentials, payloads, or provider data.
  const safe=new Set(['INVALID_DEMO_COMMAND','DEMO_CONFIG_FILE_REQUIRED','DEMO_CONFIG_ALREADY_EXISTS','DEMO_CONFIG_MUST_BE_GIT_IGNORED',
    'ISOLATION_NOT_CONFIRMED','DEMO_DATABASE_URL_REQUIRED','DEDICATED_DEMO_DATABASE_NAME_REQUIRED','PROTECTED_DATABASE_REFUSED',
    'NONEMPTY_OR_PARTIAL_DEMO_SETUP_REQUIRES_REVIEW','DEMO_NOT_SEEDED','DEMO_DATABASE_MARKER_MISSING','MIGRATION_CHECKSUM_MISMATCH',
    'DATABASE_NOT_EMPTY_OR_NOT_OWNED','DEMO_MIGRATION_HISTORY_MISMATCH','UNEXPECTED_DEMO_SCHEMA','DEMO_WORKFLOW_INVARIANT_FAILED','DEMO_API_STATUS_MISMATCH']);
  console.error('Demo stopped: '+(safe.has(error.message)?error.message:'DEMO_OPERATION_REFUSED_OR_FAILED')+'. No credentials or connection details logged.');
  process.exitCode=1;
}
