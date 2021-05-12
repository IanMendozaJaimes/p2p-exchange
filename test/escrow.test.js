const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance } = require('../scripts/eosio-util')
const { getSeedsContracts, seedsContracts, seedsAccounts, seedsSymbol } = require('../scripts/seeds-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode } = require('../scripts/config')

const { escrow } = contractNames
const { firstuser, seconduser, thirduser, fourthuser } = seedsAccounts

describe('Escrow', function () {

  let contracts
  let seeds
  let seedsUsers

  before(async function () {

    if (!isLocalNode()) {
      console.log('These tests should only be run on local node')
      process.exit(1)
    }

    contracts = await getContracts([escrow])
    seeds = await getSeedsContracts([seedsContracts.token, seedsContracts.accounts])
    seedsUsers = [firstuser, seconduser, thirduser]

  })

  beforeEach(async function () {
    await contracts.escrow.reset({ authorization: `${escrow}@active` })
    await seeds.accounts.reset({ authorization: `${seedsContracts.accounts}@active` })

    for (const user of seedsUsers) {
      await seeds.accounts.adduser(user, user, 'individual', { authorization: `${seedsContracts.accounts}@active` })
    }

    await seeds.accounts.testresident(firstuser, { authorization: `${seedsContracts.accounts}@active` })
    await seeds.accounts.testcitizen(seconduser, { authorization: `${seedsContracts.accounts}@active` })

    await contracts.escrow.upsertuser(firstuser, [{'key': 'signal', 'value': '123456789'}], [{'key': 'paypal', 'value': 'url'}], 'gmt', 'usd', { authorization: `${firstuser}@active` })
    await contracts.escrow.upsertuser(seconduser, [{'key': 'signal', 'value': '987654321'}], [{'key': 'paypal', 'value': 'url2'}], 'gmt', 'mxn', { authorization: `${seconduser}@active` })
    await contracts.escrow.upsertuser(thirduser, [{'key': 'signal', 'value': '123456789'}], [{'key': 'paypal', 'value': 'url3'}], 'udt', 'eur', { authorization: `${thirduser}@active` })
  })

  it('Transfer Seeds', async function () {
    
    console.log('deposit to the escrow contract')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(seconduser, escrow, '2000.0000 SEEDS', '', { authorization: `${seconduser}@active` })

    let atLeastResidents = true
    try {
      await seeds.token.transfer(thirduser, escrow, '3000.0000 SEEDS', '', { authorization: `${thirduser}@active` })
      atLeastResidents = false
    } catch (error) {
      assertError({
        error,
        textInside: 'user must be at least a resident',
        message: 'user must be at least a resident (expected)',
        throwError: true
      })
    }

    let onlySeedsUsers = true
    try {
      await contracts.escrow.upsertuser(fourthuser, [{'key': 'signal', 'value': '1222222222'}], [{'key': 'paypal', 'value': 'url4'}], 'udt', 'eur', { authorization: `${fourthuser}@active` })
      onlySeedsUsers = false
    } catch (error) {
      assertError({
        error,
        textInside: `${fourthuser} account is not a seeds user`,
        message: 'not a seeds user (expected)',
        throwError: true
      })
    }

    let onlyRegisteredUsers = true
    try {
      await seeds.token.transfer(fourthuser, escrow, '1000.0000 SEEDS', '', { authorization: `${fourthuser}@active` })
      onlyRegisteredUsers = false
    } catch (error) {
      assertError({
        error,
        textInside: 'user not found',
        message: 'user not found (expected)',
        throwError: true
      })
    }

    assert.deepStrictEqual(atLeastResidents, true)
    assert.deepStrictEqual(onlySeedsUsers, true)
    assert.deepStrictEqual(onlyRegisteredUsers, true)

    console.log('withdraw Seeds from escrow contract')
    const firstuserBalanceBefore = await getAccountBalance(seedsContracts.token, firstuser, seedsSymbol)
    await contracts.escrow.withdraw(firstuser, '500.0000 SEEDS',{ authorization: `${firstuser}@active` })
    await contracts.escrow.withdraw(firstuser, '500.0000 SEEDS',{ authorization: `${firstuser}@active` })
    const firstuserBalanceAfter = await getAccountBalance(seedsContracts.token, firstuser, seedsSymbol)

    let onlyAvailableBalance = true
    try {
      await contracts.escrow.withdraw(seconduser, '2000.0001 SEEDS',{ authorization: `${seconduser}@active` })
      onlyAvailableBalance = false
    } catch (error) {
      assertError({
        error,
        textInside: 'user does not have enough available balance',
        message: 'not enough balance (expected)',
        throwError: true
      })
    }

    assert.deepStrictEqual(firstuserBalanceAfter - firstuserBalanceBefore, 1000.0)
    assert.deepStrictEqual(onlyAvailableBalance, true)

    const escrowBalances = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(escrowBalances.rows, [
      {
        account: firstuser,
        available_balance: '0.0000 SEEDS',
        swap_balance: '0.0000 SEEDS',
        escrow_balance: '0.0000 SEEDS'
      },
      {
        account: seconduser,
        available_balance: '2000.0000 SEEDS',
        swap_balance: '0.0000 SEEDS',
        escrow_balance: '0.0000 SEEDS'
      }
    ])

  })

  it('Sell offers', async function () {

    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(seconduser, escrow, '2000.0000 SEEDS', '', { authorization: `${seconduser}@active` })
    
    console.log('create sell offer')
    await contracts.escrow.addselloffer(seconduser, '1500.3333 SEEDS', 11000, { authorization: `${seconduser}@active` })

    let atLeastResidents = true
    try {
      await contracts.escrow.addselloffer(thirduser, '1500 SEEDS', 11000, { authorization: `${thirduser}@active` })
      atLeastResidents = false
    } catch (error) {
      assertError({
        error,
        textInside: 'user must be at least a resident',
        message: 'user must be at least a resident (expected)',
        throwError: true
      })
    }

    let onlyAvailableBalance = true
    try {
      await contracts.escrow.addselloffer(firstuser, '1500.3333 SEEDS', 11000, { authorization: `${firstuser}@active` })
      onlyAvailableBalance = false
    } catch (error) {
      assertError({
        error,
        textInside: 'user does not have enough available balance to create the offer',
        message: 'not enough available balance (expected)',
        throwError: true
      })
    }

    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 9300, { authorization: `${firstuser}@active` })

    const escrowBalances = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })
    console.log(escrowBalances)

    const sellOffers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })
    console.log(JSON.stringify(sellOffers, null, 2))

    console.log('delete sell offer')
    await contracts.escrow.cancelsoffer(1, { authorization: `${firstuser}@active` })

    let onlyOwnerOfTheOffer = true
    try {
      await contracts.escrow.cancelsoffer(0, { authorization: `${firstuser}@active` })
      onlyOwnerOfTheOffer = false
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of ${seconduser}`,
        message: 'only the owner can cancel (expected)',
        throwError: true
      })
    }

    console.log('___________________________________________________________')

    const escrowBalances2 = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })
    console.log(escrowBalances2)

    const sellOffers2 = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })
    console.log(JSON.stringify(sellOffers2, null, 2))

  })

  it('Buy offers', async function () {

    console.log('deposit to the escrow contract')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(seconduser, escrow, '2000.0000 SEEDS', '', { authorization: `${seconduser}@active` })

    console.log('create sell offer')
    await contracts.escrow.addselloffer(seconduser, '1500.3333 SEEDS', 11000, { authorization: `${seconduser}@active` })
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })

    await contracts.escrow.addbuyoffer(thirduser, 0, '333.7777 SEEDS', 'paypal', { authorization: `${thirduser}@active` })

    const buyOffers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })
    console.log(JSON.stringify(buyOffers, null, 2))

  })

})
