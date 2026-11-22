import pg from 'pg';
export function academicPool(config){
 const url=new URL(config.url);for(const key of ['sslmode','channel_binding'])url.searchParams.delete(key);
 return new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,
  options:'-c timezone=UTC -c search_path=public',max:config.max,connectionTimeoutMillis:10000,query_timeout:10000,statement_timeout:10000,idleTimeoutMillis:30000});
}
