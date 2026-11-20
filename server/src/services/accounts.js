import { hashPassword } from './passwords.js';

export async function createAccount(repository, actorId, data, bootstrap = false) {
  const password_hash = await hashPassword(data.password);
  return repository.transaction(async client => {
    if (bootstrap) {
      if (!await repository.isEmpty(client)) throw Object.assign(new Error('Bootstrap unavailable'), { status: 409 });
    } else await repository.requireActiveAdmin(client, actorId);
    const user = await repository.insertUser(client, { ...data, password_hash });
    await repository.audit(client, bootstrap ? user.user_id : actorId,
      bootstrap ? 'account.bootstrap' : `account.created:${user.user_id}`);
    return user;
  });
}
