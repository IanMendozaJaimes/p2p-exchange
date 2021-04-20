const assert = require('assert')
const { getContracts } = require('../scripts/eosio-util')
const { getSeedsContracts, seedsContracts, seedsAccounts } = require('../scripts/seeds-util')
const { contractNames } = require('../scripts/config')

const { escrow } = contractNames
const { firstuser, seconduser } = seedsAccounts

describe('Escrow', function () {

  let contracts
  let seeds
  let seedsUsers

  before(async function () {
    contracts = await getContracts([escrow])
    seeds = await getSeedsContracts([seedsContracts.token, seedsContracts.accounts])
    seedsUsers = [firstuser, seconduser]
  })

  beforeEach(async function () {
    await contracts.escrow.reset({ authorization: `${escrow}@active` })
    await seeds.accounts.reset({ authorization: `${seedsContracts.accounts}@active` })

    for (const user of seedsUsers) {
      await seeds.accounts.adduser(user, user, 'individual', { authorization: `${seedsContracts.accounts}@active` })
    }
    await seeds.accounts.testresident(firstuser, { authorization: `${seedsContracts.accounts}@active` })
  })

  it('Transfers seeds token!', async function () {
    await contracts.escrow.upsertuser(firstuser, [{'key': 'signal', 'value': '123456789'}], [{'key': 'paypal', 'value': 'url'}], 'gmt', 'mxn', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(firstuser, escrow, '10.0000 SEEDS', '', { authorization: `${firstuser}@active` })
  })

})
