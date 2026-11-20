export function createAuditRepository(poolProvider) {
  return {
    async list({ q, module, page, limit }) {
      const result = await poolProvider().query(`WITH filtered AS (
        SELECT l.log_id,l.user_id,u.username,u.full_name,l.action,l.module,l.logged_at
        FROM activity_logs l LEFT JOIN users u ON u.user_id=l.user_id
        WHERE ($1='' OR strpos(lower(coalesce(u.username,'')),lower($1))>0
          OR strpos(lower(coalesce(u.full_name,'')),lower($1))>0
          OR strpos(lower(coalesce(l.action,'')),lower($1))>0
          OR strpos(lower(coalesce(l.module,'')),lower($1))>0)
          AND ($2='' OR l.module=$2)
      ) SELECT (SELECT count(*)::int FROM filtered) AS total,
        coalesce((SELECT json_agg(json_build_object('log_id',r.log_id,'user_id',r.user_id,
          'username',r.username,'full_name',r.full_name,'action',r.action,'module',r.module,
          'logged_at',r.logged_at::text) ORDER BY r.logged_at DESC NULLS LAST,r.log_id DESC) FROM (
          SELECT log_id,user_id,username,full_name,action,module,logged_at
          FROM filtered ORDER BY filtered.logged_at DESC NULLS LAST,log_id DESC LIMIT $3 OFFSET $4
        ) r),'[]'::json) AS data,
        coalesce((SELECT json_agg(m.module ORDER BY m.module) FROM (
          SELECT DISTINCT module FROM activity_logs WHERE module IS NOT NULL AND module<>'' AND length(module)<=200
        ) m),'[]'::json) AS modules`, [q, module, limit, (page - 1) * limit]);
      return { ...result.rows[0], page, limit };
    },
  };
}
