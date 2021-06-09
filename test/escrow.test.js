const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance } = require('../scripts/eosio-util')
const { getSeedsContracts, seedsContracts, seedsAccounts, seedsSymbol } = require('../scripts/seeds-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')

const { escrow } = contractNames
const { firstuser, seconduser, thirduser, fourthuser } = seedsAccounts

describe('Escrow', async function () {

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
    await setParamsValue()
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

    const sellOffers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

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

  })

  it('Buy offers', async function () {

    console.log('deposit to the escrow contract')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(seconduser, escrow, '2000.0000 SEEDS', '', { authorization: `${seconduser}@active` })

    console.log('create sell offer')
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })
    await contracts.escrow.addselloffer(seconduser, '500.0000 SEEDS', 11000, { authorization: `${seconduser}@active` })

    console.log('Add buy offers')
    let allowedPaymentMethods = true
    try {
      await contracts.escrow.addbuyoffer(thirduser, 0, '1000.0000 SEEDS', 'bank', { authorization: `${thirduser}@active` })
      allowedPaymentMethods = false
    } catch (error) {
      assertError({
        error,
        textInside: 'payment method is not allowed',
        message: 'payment method is not allowed (expected)',
        throwError: true
      })
    }

    let onlyEnoughFoundsInSaleOffer = true
    try {
      await contracts.escrow.addbuyoffer(thirduser, 0, '1001.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })
      onlyEnoughFoundsInSaleOffer = false
    } catch (error) {
      assertError({
        error,
        textInside: 'sell offer does not have enough funds',
        message: 'sell offer does not have enough funds (expected)',
        throwError: true
      })
    }

    let onlyIfOfferExists = true
    try {
      await contracts.escrow.addbuyoffer(thirduser, 3, '1000.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })
      onlyIfOfferExists = false
    } catch (error) {
      assertError({
        error,
        textInside: 'sell offer not found',
        message: 'sell offer not found (expected)',
        throwError: true
      })
    }

    let minOffer = true
    try {
      await contracts.escrow.addbuyoffer(thirduser, 1, '0.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })
      minOffer = false
    } catch (error) {
      assertError({
        error,
        textInside: 'quantity must be greater than 0',
        message: 'quantity must be greater than 0 (expected)',
        throwError: true
      })
    }

    let notSelffOffer = true
    try {
      await contracts.escrow.addbuyoffer(firstuser, 0, '1000.0000 SEEDS', 'paypal', { authorization: `${firstuser}@active` })
      notSelffOffer = false
    } catch (error) {
      assertError({
        error,
        textInside: 'can not propose a buy offer for your own sell offer',
        message: 'can not propose a buy offer for your own sell offer (expected)',
        throwError: true
      })
    }

    console.log('Delete buy offers')
    try {
      await contracts.escrow.addbuyoffer(thirduser, 0, '1000.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })
    } catch (error) {
      console.log('error', error)
    }

    let onlyDeleteBuyOffer = true
    try {
      await contracts.escrow.delbuyoffer(0, { authorization: `${seconduser}@active` })
      onlyDeleteBuyOffer = false
    } catch (error) {
      assertError({
        error,
        textInside: 'offer is not a buy offer',
        message: 'offer is not a buy offer (expected)',
        throwError: true
      })
    }

    let onlyOwnerCanDelete = true
    try {
      await contracts.escrow.delbuyoffer(2, { authorization: `${seconduser}@active` })
      onlyOwnerCanDelete = false
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of ${thirduser}`,
        message: `missing authority of ${thirduser} (expected)`,
        throwError: true
      })
    }

    let onlyInTimeRange = true
    try {
      await contracts.escrow.delbuyoffer(2, { authorization: `${thirduser}@active` })
      let onlyInTimeRange = false
    } catch (error) {
      assertError({
        error,
        textInside: 'can not delete offer, it is too early',
        message: 'can not delete offer, it is too early (expected)',
        throwError: true
      })
    }

    try {
      await contracts.escrow.accptbuyoffr(2, { authorization: `${firstuser}@active` })
    } catch (error) {
      console.log('error', error)
    }

    let onlyPending = true
    try {
      await contracts.escrow.delbuyoffer(2, { authorization: `${thirduser}@active` })
      onlyPending = false
    } catch (error) {
      assertError({
        error,
        textInside: 'can not delete offer, status is not pending',
        message: 'can not delete offer, status is not pending (expected)',
        throwError: true
      })
    }

    console.log('pay offers')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })
    await contracts.escrow.addbuyoffer(seconduser, 3, '1000.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })

    let onlyPayAccepted = true
    try {
      await contracts.escrow.payoffer(0, { authorization: `${seconduser}@active` })
      onlyPayAccepted = false
    } catch (error) {
      assertError({
        error,
        textInside: 'offer is not a buy offer',
        message: 'offer is not a buy offer (expected)',
        throwError: true
      })
    }


    let onlyPayBuyOffers = true
    try {
      await contracts.escrow.payoffer(4, { authorization: `${seconduser}@active` })
      onlyPayBuyOffers = false
    } catch (error) {
      assertError({
        error,
        textInside: 'can not pay the offer, the offer is not accepted',
        message: 'can not pay the offer, the offer is not accepted (expected)',
        throwError: true
      })
    }

    assert.deepStrictEqual(onlyEnoughFoundsInSaleOffer, true)
    assert.deepStrictEqual(onlyIfOfferExists, true)
    assert.deepStrictEqual(minOffer, true)
    assert.deepStrictEqual(allowedPaymentMethods, true)
    assert.deepStrictEqual(notSelffOffer, true)
    assert.deepStrictEqual(onlyDeleteBuyOffer, true)
    assert.deepStrictEqual(onlyOwnerCanDelete, true)
    assert.deepStrictEqual(onlyInTimeRange, true)
    assert.deepStrictEqual(onlyPending, true)
    assert.deepStrictEqual(onlyPayAccepted, true)
    assert.deepStrictEqual(onlyPayBuyOffers, true)
  })

  it('Add arbiter', async function () {

    let onlyContractOwner = true
    try {
      await contracts.escrow.addarbiter(firstuser, { authorization: `${firstuser}@active` })
      onlyContractOwner = false
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of ${escrow}`,
        message: `missing authority of ${escrow} (expected)`,
        throwError: true
      })
    }

    await contracts.escrow.addarbiter(firstuser, { authorization: `${escrow}@active` })

    let onlyNotArbiters = true
    try {
      await contracts.escrow.addarbiter(firstuser, { authorization: `${escrow}@active` })
      onlyNotArbiters = false
    } catch (error) {
      assertError({
        error,
        textInside: 'user is already arbiter',
        message: 'user is already arbiter (expected)',
        throwError: true
      })
    }

    await contracts.escrow.delarbiter(firstuser, { authorization: `${escrow}@active` })

    let canAddArbiter = false
    try {
      await contracts.escrow.addarbiter(firstuser, { authorization: `${escrow}@active` })
      canAddArbiter = true
    } catch (error) {
      console.log('error', error)
    }

    const users = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'users',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(onlyContractOwner, true)
    assert.deepStrictEqual(onlyNotArbiters, true)
    assert.deepStrictEqual(canAddArbiter, true)
    assert.deepStrictEqual(users.rows[0].is_arbiter, 1)
  })

  it('Del arbiter', async function () {

    let onlyContractOwner = true
    try {
      await contracts.escrow.delarbiter(firstuser, { authorization: `${firstuser}@active` })
      onlyContractOwner = false
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of ${escrow}`,
        message: `missing authority of ${escrow} (expected)`,
        throwError: true
      })
    }

    let onlyArbiter = true
    try {
      await contracts.escrow.delarbiter(firstuser, { authorization: `${escrow}@active` })
      onlyArbiter = false
    } catch (error) {
      assertError({
        error,
        textInside: 'user is not arbiter',
        message: 'user is not arbiter (expected)',
        throwError: true
      })
    }

    try {
      await contracts.escrow.addarbiter(firstuser, { authorization: `${escrow}@active` })
    } catch (error) {
      console.log('error', error)
    }

    let canDelArbiter = false
    try {
      await contracts.escrow.delarbiter(firstuser, { authorization: `${escrow}@active` })
      canDelArbiter = true
    } catch (error) {
      console.log('error', error)
    }

    const users = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'users',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(onlyContractOwner, true)
    assert.deepStrictEqual(onlyArbiter, true)
    assert.deepStrictEqual(canDelArbiter, true)
    assert.deepStrictEqual(users.rows[0].is_arbiter, 0)
  })

  await it('Init arbitrage', async function () {
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(seconduser, escrow, '1000.0000 SEEDS', '', { authorization: `${seconduser}@active` })

    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })
    await contracts.escrow.addbuyoffer(seconduser, 0, '1000.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })
    await contracts.escrow.payoffer(1, { authorization: `${seconduser}@active` })
    console.time('paid')

    try {
      await contracts.escrow.initarbitrage(1, { authorization: `${escrow}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of ${seconduser}`,
        message: `missing authority of ${seconduser} (expected)`,
        throwError: true
      })
    }

    let onlyAfter24h = true
    try {
      await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })
      onlyAfter24h = false
    } catch (error) {
      assertError({
        error,
        textInside: 'can not create arbitrage, it is too early',
        message: 'can not create arbitrage, it is too early (expected)',
        throwError: true
      })
    }

    await setTimeout(async () => {
      var canCreateArbitrage = false
      await setParamsValue(true)
      try {
        await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })
        canCreateArbitrage = true
      } catch (error) {
        console.log('error', error)
      }
      await assert.deepStrictEqual(canCreateArbitrage, true)
      console.log('can create arbitrage if time passed (expected)')
    }, 2000);

    await setTimeout(async () => {
      await setParamsValue(true)
      try {
        await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })
      } catch (error) {
        assertError({
          error,
          textInside: 'arbitrage already exists',
          message: 'arbitrage already exists (expected)',
          throwError: true
        })
      }
    }, 2500);

    await assert.deepStrictEqual(onlyAfter24h, true)
  })



})
