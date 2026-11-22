// Local QA only. Stay above Fetch's blocked-service port range without
// disabling browser/Node Fetch port protections or exposing a LAN listener.
import {once} from 'node:events';
import {createServer} from 'node:net';
import {randomInt} from 'node:crypto';
export const usableHttpPort=port=>Number.isInteger(port)&&port>=16384&&port<=65535;
export async function listenForFetch(app){
  for(let attempt=0;attempt<50;attempt++){
    // Port 0 may repeatedly return the same rejected port after immediate close.
    // Request a high port explicitly; collisions are retried, never bypassed.
    const server=app.listen(randomInt(16384,65536),'127.0.0.1');
    try{await once(server,'listening');}
    catch(error){if(['EADDRINUSE','EACCES'].includes(error.code))continue;throw error;}
    if(usableHttpPort(server.address().port))return server;
    await new Promise(resolve=>server.close(resolve));
  }
  throw new Error('Unable to allocate a permitted high loopback HTTP port.');
}
export async function freeHttpPort(){
  const server=await listenForFetch(createServer());const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));return port;
}
