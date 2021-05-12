const { api, rpc } = require('./eos')
const { nameOnChainToName, contractNames, isLocalNode } = require('./config')

function getNonce () {
  if (isLocalNode()) {
    return [{
      account: contractNames.nullcontract,
      name: 'nonce',
      authorization: [
        {
          actor: contractNames.nullcontract,
          permission: 'active'
        }
      ],
      data: { random: Math.random().toString().substring(0, 8) }
    }]
  }
  return []
}

async function initContract (account) {
  const contract = await api.getContract(account)
  const functions = {}
  for (let [_, action] of contract.actions) {
    functions[action.name] = async function () {
      let auth
      const { authorization } = arguments[arguments.length - 1]
      if (Array.isArray(authorization)) {
        auth = authorization
      } else {
        let [actor, permission] = authorization.split('@')
        auth = [{
          actor,
          permission,
        }]
      }
      
      const data = {}

      if (action.fields.length > 0 && arguments.length == 2 && typeof arguments[0] === 'object') {
        for (let i = 0; i < action.fields.length; i++) {
          const { name } = action.fields[i]
          data[name] = arguments[0][name]
        }
      } else {
        if ((action.fields.length + 1) != arguments.length) {
          throw new Error(`Not enough arguments to call ${action.name} action in ${account} contract`)
        }
        for (let i = 0; i < action.fields.length; i++) {
          const { name } = action.fields[i]
          data[name] = arguments[i]
        }
      }

      const nonce = getNonce() 
      const actions = [
        {
          account,
          name: action.name,
          authorization: auth,
          data
        },
        ...nonce
      ]
      
      const res = await api.transact({
        actions
      }, {
        blocksBehind: 3,
        expireSeconds: 30
      })

      return res
    }
  }
  return { ...contract, ...functions }
}

async function getContracts (accounts) {
  accounts = Array.isArray(accounts) ? accounts : [accounts]
  const c = {}
  for (const account of accounts) {
    c[nameOnChainToName[account]] = await initContract(account)
  }
  return c
}

async function getAccountBalance (contract, account, token) {
  const balance = await rpc.get_currency_balance(contract, account, token)
  return Number.parseFloat(balance[0]) || 0
}

module.exports = {
  getContracts, initContract, getAccountBalance
}
