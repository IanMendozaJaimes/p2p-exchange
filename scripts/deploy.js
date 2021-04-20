const { api } = require('./eos')
const { Serialize } = require('eosjs')
const fs = require('fs')
const { join } = require('path')
const { isLocalNode } = require('./config')

async function getWasmAbi (contractName) {
  const codePath = join(__dirname, `../compiled/${contractName}.wasm`)
  const abiPath = join(__dirname, `../compiled/${contractName}.abi`)

  const code = new Promise(resolve => {
    fs.readFile(codePath, (_, r) => resolve(r))
  })
  const abi = new Promise(resolve => {
    fs.readFile(abiPath, (_, r) => resolve(r))
  })

  return Promise.all([code, abi]).then(([code, abi]) => ({ code, abi }))
}


async function setCode ({ account, code, vmtype, vmversion }, { authorization }) {

  const wasmHexString = code.toString('hex')
  let [actor, permission] = authorization.split('@')

  const res = await api.transact({
    actions: [{
      account: 'eosio',
      name: 'setcode',
      authorization: [{
        actor,
        permission,
      }],
      data: {
        account,
        code: wasmHexString,
        vmtype,
        vmversion
      }
    }]
  },
  {
    blocksBehind: 3,
    expireSeconds: 30
  })

  return res

}

async function setAbi ({ account, abi }, { authorization }) {

  const buffer = new Serialize.SerialBuffer({
    textEncoder: api.textEncoder,
    textDecoder: api.textDecoder
  })

  const abiDefinitions = api.abiTypes.get('abi_def')
  abi = abiDefinitions.fields.reduce(
    (acc, { name: fieldName }) =>
        Object.assign(acc, { [fieldName]: acc[fieldName] || [] }),
        abi
    )

  abiDefinitions.serialize(buffer, abi)
  const serializedAbiHexString = Buffer.from(buffer.asUint8Array()).toString('hex')

  let [actor, permission] = authorization.split('@')

  const res = await api.transact({
    actions: [{
      account: 'eosio',
      name: 'setabi',
      authorization: [{
        actor,
        permission,
      }],
      data: {
        account,
        abi: serializedAbiHexString
      }
    }]
  },
  {
    blocksBehind: 3,
    expireSeconds: 30
  })

  return res

}


async function createAccount ({ account, publicKey, stakes, creator }) {

  if (isLocalNode()) {
    await api.transact({
      actions: [
        {
          account: 'eosio',
          name: 'newaccount',
          authorization: [{
            actor: creator,
            permission: 'active',
          }],
          data: {
            creator,
            name: account,
            owner: {
              threshold: 1,
              keys: [{
                key: publicKey,
                weight: 1
              }],
              accounts: [],
              waits: []
            },
            active: {
              threshold: 1,
              keys: [{
                key: publicKey,
                weight: 1
              }],
              accounts: [],
              waits: []
            },
          }
        }
      ]
    }, {
      blocksBehind: 3,
      expireSeconds: 30
    })  
  } else {
    await api.transact({
      actions: [
        {
          account: 'eosio',
          name: 'newaccount',
          authorization: [{
            actor: creator,
            permission: 'active',
          }],
          data: {
            creator,
            name: account,
            owner: {
              threshold: 1,
              keys: [{
                key: publicKey,
                weight: 1
              }],
              accounts: [],
              waits: []
            },
            active: {
              threshold: 1,
              keys: [{
                key: publicKey,
                weight: 1
              }],
              accounts: [],
              waits: []
            },
          }
        },
        {
          account: 'eosio',
          name: 'buyrambytes',
          authorization: [{
            actor: creator,
            permission: 'active',
          }],
          data: {
            payer: creator,
            receiver: account,
            bytes: stakes.ram,
          },
        },
        {
          account: 'eosio',
          name: 'delegatebw',
          authorization: [{
            actor: creator,
            permission: 'active',
          }],
          data: {
            from: creator,
            receiver: account,
            stake_net_quantity: stakes.net,
            stake_cpu_quantity: stakes.cpu,
            transfer: false,
          }
        }
      ]
    }, {
      blocksBehind: 3,
      expireSeconds: 30
    })  
  }

}


async function deployContract (contract) {

  const { code: wasm, abi } = await getWasmAbi(contract.name)

  await setCode({
    account: contract.nameOnChain,
    code: wasm,
    vmtype: 0,
    vmversion: 0
  }, {
    authorization: `${contract.nameOnChain}@active`
  })

  await setAbi({
    account: contract.nameOnChain,
    abi: JSON.parse(abi)
  }, {
    authorization: `${contract.nameOnChain}@active`
  })

}

module.exports = { createAccount, deployContract }
