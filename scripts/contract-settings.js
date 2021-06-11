const { transact, rpc } = require('./eos')
let params = require('./config/params.json')
const testparams = require('./config/testparams.json')
const { contractNames } = require('../scripts/config')
const { settings } = contractNames

async function setParamsValue (test = false) {
  if (test) params = testparams
  const keys = Object.keys(params)

  for (const key of keys) {
    await transact({
      actions: [{
        account: settings,
        name: 'setparam',
        authorization: [{
          actor: settings,
          permission: 'active',
        }],
        data: {
          key,
          ...params[key]
        }
      }]
    })
  }
}

async function getParams () {
  const res = await rpc.get_table_rows({
    code: settings,
    scope: settings,
    table: 'config',
    json: true,
    limit: 200
  })
  return res.rows
}

module.exports = {
  setParamsValue, getParams
}
