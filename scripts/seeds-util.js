const { initContract } = require('./eosio-util')

const seedsSymbol = 'SEEDS'

const seedsContracts = {
  token: 'token.seeds',
  accounts: 'accts.seeds'
}

const seedsAccounts = {
  firstuser: 'seedsuseraaa',
  seconduser: 'seedsuserbbb',
  thirduser: 'seedsuserccc',
  fourthuser: 'seedsuseryyy'
}

const seedsNameOnChainToName = {}

const keys = Object.keys(seedsContracts)
for (const key of keys) {
  seedsNameOnChainToName[seedsContracts[key]] = key
}

async function getSeedsContracts (accounts) {
  accounts = Array.isArray(accounts) ? accounts : [accounts]
  const c = {}
  for (const account of accounts) {
    c[seedsNameOnChainToName[account]] = await initContract(account)
  }
  return c
}

module.exports = {
  seedsSymbol, seedsContracts, seedsNameOnChainToName, seedsAccounts, getSeedsContracts
}
