const assert = require('assert')
const { getContracts } = require('../scripts/eosio-util')
const { contractNames } = require('../scripts/config')

const { settings } = contractNames

describe('Settings', function () {

  let contracts

  before(async function () {
    contracts = await getContracts([settings])
  })

  beforeEach(async function () {
    await contracts.settings.reset({ authorization: `${settings}@active` })
  })

  it('Set a new param', async function () {
    await contracts.settings.setparam('testparam', ['uint64', 20], 'test param', { authorization: `${settings}@active` })
  })

})
