const { transact, rpc } = require('./eos')
const { permissionsConfig } = require('./config')

async function updateAuth ({ account, permission, parent, auth }, { authorization }) {
  let [actor, perm] = authorization.split('@')

  if ((parent == 'owner' && permission == 'owner') || parent == '') {
    parent = '.'
  }

  auth.accounts.sort((a, b) => {
    if (a.permission.actor <= b.permission.actor) {
      return -1
    }
    return 1
  })

  return transact({
    actions: [
    {
      account: 'eosio',
      name: 'updateauth',
      authorization: [{
        actor,
        permission: perm,
      }],
      data: {
        account,
        permission,
        parent,
        auth
      },
    }]
  })
}

async function linkauth ({ account, code, type, requirement }, { authorization }) {

  let [actor, permission] = authorization.split('@')

  return await transact({
    actions: [{
      account: 'eosio',
      name: 'linkauth',
      authorization: [{
        actor,
        permission,
      }],
      data: {
        account,
        code,
        type,
        requirement
      },
    }]
  })

}

async function addActorPermission (target, targetRole, actor, actorRole) {
  try {
    const { parent, required_auth: { threshold, waits, keys, accounts } } =
      (await rpc.get_account(target))
        .permissions.find(p => p.perm_name == targetRole)

    const existingPermission = accounts.find(({ permission }) =>
      permission.actor == actor && permission.permission == actorRole
    )

    if (existingPermission)
      return console.log(`permission ${actor}@${actorRole} already exists for ${target}@${targetRole}`)

    const permissions = {
      account: target,
      permission: targetRole,
      parent,
      auth: {
        threshold,
        waits,
        accounts: [
          ...accounts,
          {
            permission: {
              actor,
              permission: actorRole
            },
            weight: 1
          }
        ],
        keys: [
          ...keys
        ]
      }
    }

    await updateAuth(permissions, { authorization: `${target}@owner` })
    console.log(`permission created on ${target}@${targetRole} for ${actor}@${actorRole}`)
  } catch (err) {
    console.error(`failed permission update on ${target} for ${actor}\n* error: ` + err + `\n`)
  }
}

async function createKeyPermission (account, role, parentRole = 'active', key) {
  try {
    const { permissions } = await rpc.get_account(account)

    const perm = permissions.find(p => p.perm_name === role)

    if (perm) {
      const { parent, required_auth } = perm
      const { keys } = required_auth
  
      if (keys.find(item => item.key === key)) {
        console.log("- createKeyPermission key already exists "+key)
        return;
      }  
    }

    await updateAuth({
      account,
      permission: role,
      parent: parentRole,
      auth: {
        threshold: 1,
        waits: [],
        accounts: [],
        keys: [{
          key,
          weight: 1
        }]
      }
    }, { authorization: `${account}@owner` })
    console.log(`permission setup on ${account}@${role}(/${parentRole}) for ${key}`)
  } catch (err) {
    console.error(`failed permission setup\n* error: ` + err + `\n`)
  }
}

async function allowAction (account, role, action) {
  try {
    await linkauth({
      account,
      code: account,
      type: action,
      requirement: role
    }, { authorization: `${account}@owner` })
    console.log(`linkauth of ${account}@${action} for ${role}`)
  } catch (err) {
    let errString = `failed allow action\n* error: ` + err + `\n`
    if (errString.includes("Attempting to update required authority, but new requirement is same as old")) {
      console.log(`linkauth of ${account}@${action} for ${role} exists`)
    } else {
      console.error(errString)
    }
  }
}

const isActorPermission = permission => permission.actor && !permission.key
const isKeyPermission = permission => permission.key && !permission.actor
const isActionPermission = permission => permission.action

async function updatePermissions () {
  for (const permission of permissionsConfig) {
    if (isActorPermission(permission)) {
      
      const { target, actor } = permission
      const [targetAccount, targetRole] = target.split('@')
      const [actorAccount, actorRole] = actor.split('@')
      await addActorPermission(targetAccount, targetRole, actorAccount, actorRole)

    } else if (isKeyPermission(permission)) {

      const { target, parent, key } = permission
      const [ targetAccount, targetRole ] = target.split('@')
      await createKeyPermission(targetAccount, targetRole, parent, key)

    } else if (isActionPermission(permission)) {

      const { target, action } = permission
      const [ targetAccount, targetRole ] = target.split('@')
      await allowAction(targetAccount, targetRole, action)
    
    }
  }
}

module.exports = { updatePermissions }
