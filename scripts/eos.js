require('dotenv').config()

const eosjs = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const { TextEncoder, TextDecoder } = require('util')
const fetch = require('node-fetch')

const { Api, JsonRpc } = eosjs

const getChainInfo = () => {
  const chainName = process.env.CHAIN_NAME
  switch(chainName) {
    case 'local':
      return {
        keyProvider: [process.env.LOCAL_PRIVATE_KEY],
        httpEndpoint: 'http://127.0.0.1:8888'
      }
    case 'telosTestnet':
      return {
        keyProvider: [process.env.TESTNET_PRIVATE_KEY],
        httpEndpoint: 'https://testnet.telos.caleos.io'
      }
    case 'telosMainnet':
      return {
        keyProvider: []
      }
    default:
      return null
  }
}

const { keyProvider, httpEndpoint } = getChainInfo()

const signatureProvider = new JsSignatureProvider(Array.isArray(keyProvider) ? keyProvider : [keyProvider])

const rpc = new JsonRpc(httpEndpoint, { fetch });
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() })

async function transact (transaction, options={}) {
  options = { blocksBehind: 3, expireSeconds: 30, ...options }
  const res = await api.transact(
    transaction,
    options
  )
  return res
}
module.exports = { rpc, api, transact }
