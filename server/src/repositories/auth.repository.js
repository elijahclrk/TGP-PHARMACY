import { randomInt } from 'node:crypto';

// Application-assigned random integer IDs preserve Phase 3. Collision retries
// use ON CONFLICT, never MAX(id)+1 or new sequences.
export async function insertWithId(client, sql, values) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await client.query(sql, [randomInt(1, 2147483647), ...values]);
    if (result.rows[0]) return result.rows[0];
  }
  throw new Error('ID allocation failed');
}

export function createAuthRepository(poolProvider) {
  const findById = async (id, client = poolProvider()) => (await client.query(
    'SELECT user_id, username, full_name, role, status, password_hash FROM users WHERE user_id=$1', [id])).rows[0];
  const audit = (client, userId, action, module = 'accounts') => insertWithId(client,
    'INSERT INTO activity_logs(log_id,user_id,action,module,logged_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT(log_id) DO NOTHING RETURNING log_id', [userId, action, module]);
  return {
    findById,
    async listUsers({ q, page, limit }) {
      const result = await poolProvider().query(`WITH filtered AS (
        SELECT user_id,username,full_name,role,status FROM users
        WHERE $1='' OR strpos(lower(username),lower($1))>0
          OR strpos(lower(coalesce(full_name,'')),lower($1))>0
      ) SELECT (SELECT count(*)::int FROM filtered) AS total,
        coalesce((SELECT json_agg(r) FROM (SELECT * FROM filtered
          ORDER BY lower(coalesce(full_name,username)),user_id LIMIT $2 OFFSET $3) r),'[]'::json) AS data`,
      [q, limit, (page - 1) * limit]);
      return { ...result.rows[0], page, limit };
    },
    async publicUserById(id) {
      return (await poolProvider().query(
        "SELECT user_id,username,full_name,role,status,(SELECT max(logged_at) AT TIME ZONE 'UTC' FROM activity_logs WHERE user_id=users.user_id AND module='accounts' AND action='auth.login') AS last_sign_in FROM users WHERE user_id=$1", [id])).rows[0];
    },
    async findByUsername(username) { return (await poolProvider().query(
      'SELECT user_id, username, full_name, role, status, password_hash FROM users WHERE username=$1', [username])).rows[0]; },
    audit,
    async transaction(work) {
      const client = await poolProvider().connect();
      try {
        await client.query('BEGIN');
        // Serializes account writes and permission rechecks, including bootstrap.
        await client.query('SELECT pg_advisory_xact_lock(742901,2)');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
      finally { client.release(); }
    },
    async requireActiveAdmin(client, id) {
      const user = await findById(id, client);
      if (!user || user.status !== 'active' || user.role !== 'admin') {
        throw Object.assign(new Error('Access denied'), { status: 403 });
      }
    },
    insertUser: (client, data) => insertWithId(client,
      "INSERT INTO users(user_id,username,password_hash,full_name,role,status) VALUES($1,$2,$3,$4,$5,'active') ON CONFLICT(user_id) DO NOTHING RETURNING user_id,username,full_name,role,status",
      [data.username, data.password_hash, data.full_name ?? null, data.role]),
    async deactivate(client, id) { return (await client.query(
      "UPDATE users SET status='inactive' WHERE user_id=$1 RETURNING user_id,username,full_name,role,status", [id])).rows[0]; },
    async isEmpty(client) {
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      return !(await client.query('SELECT 1 FROM users LIMIT 1')).rowCount;
    },
    async editUser(client,id,data){
      const fields=['username','full_name','role','status','password_hash'].filter(f=>Object.hasOwn(data,f));
      return (await client.query(`UPDATE users SET ${fields.map((f,i)=>`${f}=$${i+2}`).join(',')} WHERE user_id=$1 RETURNING user_id,username,full_name,role,status`,[id,...fields.map(f=>data[f])])).rows[0];
    },
  };
}
