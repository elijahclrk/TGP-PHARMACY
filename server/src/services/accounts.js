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
export async function updateAccount(repository,actorId,id,data){
 const patch={...data};if(patch.password){patch.password_hash=await hashPassword(patch.password);delete patch.password;}
 return repository.transaction(async client=>{
  await repository.requireActiveAdmin(client,actorId);
  const target=await repository.findById(id,client);
  if(!target)throw Object.assign(Error('Account not found'),{status:404});
  // Existing Admin protection remains: no demotion, deactivation, promotion or
  // credential takeover of the only owner through ordinary staff management.
  if(target.role==='admin'||id===actorId)throw Object.assign(Error('Administrator account changes require a separate owner procedure'),{status:403});
  const updated=await repository.editUser(client,id,patch);
  await repository.audit(client,actorId,`account.updated:${id}`);
  if(patch.password_hash)await repository.audit(client,actorId,`account.credentials_updated:${id}`);
  return updated;
 });
}
