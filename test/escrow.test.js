const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance } = require('../scripts/eosio-util')
const { getSeedsContracts, seedsContracts, seedsAccounts, seedsSymbol } = require('../scripts/seeds-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')

const { escrow } = contractNames
const { firstuser, seconduser, thirduser, fourthuser } = seedsAccounts

describe('Escrow', async function () {
  this.timeout(50000);
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

    await contracts.escrow.upsertuser(firstuser, [{ 'key': 'signal', 'value': '123456789' }], [{ 'key': 'paypal', 'value': 'url' }], 'gmt', 'usd', { authorization: `${firstuser}@active` })
    await contracts.escrow.upsertuser(seconduser, [{ 'key': 'signal', 'value': '987654321' }], [{ 'key': 'paypal', 'value': 'url2' }], 'gmt', 'mxn', { authorization: `${seconduser}@active` })
    await contracts.escrow.upsertuser(thirduser, [{ 'key': 'signal', 'value': '123456789' }], [{ 'key': 'paypal', 'value': 'url3' }], 'udt', 'eur', { authorization: `${thirduser}@active` })
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
      await contracts.escrow.upsertuser(fourthuser, [{ 'key': 'signal', 'value': '1222222222' }], [{ 'key': 'paypal', 'value': 'url4' }], 'udt', 'eur', { authorization: `${fourthuser}@active` })
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
    await contracts.escrow.withdraw(firstuser, '500.0000 SEEDS', { authorization: `${firstuser}@active` })
    await contracts.escrow.withdraw(firstuser, '500.0000 SEEDS', { authorization: `${firstuser}@active` })
    const firstuserBalanceAfter = await getAccountBalance(seedsContracts.token, firstuser, seedsSymbol)

    let onlyAvailableBalance = true
    try {
      await contracts.escrow.withdraw(seconduser, '2000.0001 SEEDS', { authorization: `${seconduser}@active` })
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


    console.log('Pay offers')
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
    // print table to see soldout status
    const sellOffers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    console.log(JSON.stringify(sellOffers, null, 2))

    /// reject buy offer
    console.log('Reject offer')

    let onlyRejectBySeller = true
    try {
      await contracts.escrow.rejctbuyoffr(4, { authorization: `${seconduser}@active` })
      onlyRejectBySeller = false
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of ${firstuser}`,
        message: `missing authority of ${firstuser} (expected)`,
        throwError: true
      })
    }

    let onlyRejectBuyOffers = true
    try {
      await contracts.escrow.rejctbuyoffr(3, { authorization: `${firstuser}@active` })
      onlyRejectBuyOffers = false
    } catch (error) {
      assertError({
        error,
        textInside: 'offer is not a buy offer',
        message: 'offer is not a buy offer (expected)',
        throwError: true
      })
    }

    let onlyRejectPendingBuyOffers = true
    try {
      await contracts.escrow.rejctbuyoffr(2, { authorization: `${firstuser}@active` })
      onlyRejectPendingBuyOffers = false
    } catch (error) {
      assertError({
        error,
        textInside: 'can not reject this buy offer, it\'s status is not pending',
        message: 'can not reject this buy offer, it\'s status is not pending (expected)',
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
    assert.deepStrictEqual(onlyRejectBySeller, true)
    assert.deepStrictEqual(onlyRejectBuyOffers, true)
    assert.deepStrictEqual(onlyRejectPendingBuyOffers, true)
  })

  it('Cancels sell offer', async function () {

    console.log('deposit to the escrow contract')
    await seeds.token.transfer(seconduser, escrow, '2000.0000 SEEDS', '', { authorization: `${seconduser}@active` })
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })

    console.log('create sell offer')
    await contracts.escrow.addselloffer(seconduser, '1200.0000 SEEDS', 11000, { authorization: `${seconduser}@active` })
    await contracts.escrow.addselloffer(firstuser, '500.0000 SEEDS', 10000, { authorization: `${firstuser}@active` })

    console.log('Add buy offers')
    await contracts.escrow.addbuyoffer(thirduser, 0, '400.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })
    await contracts.escrow.addbuyoffer(firstuser, 0, '200.0000 SEEDS', 'paypal', { authorization: `${firstuser}@active` })
    await contracts.escrow.addbuyoffer(seconduser, 1, '450.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })

    console.log('Cancel sell offer id 0')

    await contracts.escrow.cancelsoffer(0, { authorization: `${seconduser}@active` })

    const sellOffers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    console.log(JSON.stringify(sellOffers, null, 2))

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

    await contracts.escrow.addarbiter(firstuser, { authorization: `${escrow}@active` })

    const users = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'users',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(onlyContractOwner, true)
    assert.deepStrictEqual(onlyNotArbiters, true)
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

    await contracts.escrow.addarbiter(firstuser, { authorization: `${escrow}@active` })

    await contracts.escrow.delarbiter(firstuser, { authorization: `${escrow}@active` })

    const users = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'users',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(onlyContractOwner, true)
    assert.deepStrictEqual(onlyArbiter, true)
    assert.deepStrictEqual(users.rows[0].is_arbiter, 0)
  })

  it('Init arbitrage', async function () {
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(seconduser, escrow, '1000.0000 SEEDS', '', { authorization: `${seconduser}@active` })

    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })
    await contracts.escrow.addbuyoffer(seconduser, 0, '1000.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })
    await contracts.escrow.payoffer(1, { authorization: `${seconduser}@active` })
    console.log('paid')

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

    console.time('sleep')
    await sleep(2000)
    console.timeLog('sleep')

    await setParamsValue(true)
    await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })

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

    const offers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    const arbitoffs = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'arbitoffs',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(offers.rows[1].status_history.find(el => el.key === 'a.pending').key, 'a.pending')
    assert.deepStrictEqual(offers.rows[1].current_status, 'a.pending')

    delete arbitoffs.rows[0].created_date
    delete arbitoffs.rows[0].resolution_date
    assert.deepStrictEqual(arbitoffs.rows, [
      {
        "offer_id": 1,
        "arbiter": "pending",
        "resolution": "pending",
        "notes": "",
        "seller_contact": [{
          "key": firstuser,
          "value": 0
        }],
        "buyer_contact": [{
          "key": seconduser,
          "value": 0
        }]
      }
    ])
    assert.deepStrictEqual(onlyAfter24h, true)
  })

  it('Arbitrage offer', async function () {
    console.log('transafer tokens')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })
    await seeds.token.transfer(seconduser, escrow, '1000.0000 SEEDS', '', { authorization: `${seconduser}@active` })

    console.log('add, accept and pay offers')
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })
    await contracts.escrow.addbuyoffer(seconduser, 0, '1000.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })
    await contracts.escrow.payoffer(1, { authorization: `${seconduser}@active` })

    console.time('sleep2')
    await sleep(2000)
    console.timeLog('sleep2')

    console.log('create arbitrage')
    await setParamsValue(true)
    await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })

    try {
      await contracts.escrow.arbtrgeoffer(thirduser, 1, { authorization: `${thirduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'user is not arbiter',
        message: 'user is not arbiter (expected)',
        throwError: true
      })
    }

    console.log('add arbiter')
    await contracts.escrow.addarbiter(thirduser, { authorization: `${escrow}@active` })

    try {
      await contracts.escrow.arbtrgeoffer(thirduser, 1, { authorization: `${seconduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of ${thirduser}`,
        message: `missing authority of ${thirduser} (expected)`,
        throwError: true
      })
    }

    await contracts.escrow.arbtrgeoffer(thirduser, 1, { authorization: `${thirduser}@active` })

    const arbitoffs = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'arbitoffs',
      json: true,
      limit: 100
    })

    delete arbitoffs.rows[0].created_date
    delete arbitoffs.rows[0].resolution_date
    assert.deepStrictEqual(arbitoffs.rows, [
      {
        "offer_id": 1,
        "arbiter": "seedsuserccc",
        "resolution": "a.inprogress",
        "notes": "",
        "seller_contact": [{
          "key": firstuser,
          "value": 0
        }],
        "buyer_contact": [{
          "key": seconduser,
          "value": 0
        }]
      }
    ])

    const offers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    delete offers.rows[1].created_date

    assert.deepStrictEqual(offers.rows[1].current_status, 'a.inprogress')

    const inArbitrage = offers.rows[1].status_history.find(el => el.key === 'a.inprogress')

    delete inArbitrage.value

    assert.deepStrictEqual({ key: 'a.inprogress' }, inArbitrage)
  })

  it('Resolve seller', async function () {
    console.log('transafer tokens')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })

    console.log('add, accept and pay offers')
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })

    await contracts.escrow.addbuyoffer(seconduser, 0, '500.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.addbuyoffer(thirduser, 0, '500.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })

    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })
    await contracts.escrow.accptbuyoffr(2, { authorization: `${firstuser}@active` })

    // await contracts.escrow.payoffer(1, { authorization: `${seconduser}@active` })
    await contracts.escrow.payoffer(2, { authorization: `${thirduser}@active` })

    try {
      await contracts.escrow.resolvesellr(1, "", { authorization: `${thirduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'arbitrage does not exist',
        message: 'arbitrage does not exist (expected)',
        throwError: true
      })
    }

    console.time('sleep3')
    await sleep(2000)
    console.timeLog('sleep3')

    console.log('create arbitrage')
    await setParamsValue(true)
    await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })

    try {
      await contracts.escrow.resolvesellr(1, "", { authorization: `${thirduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'this arbitration ticket isn\'t in progress',
        message: 'this arbitration ticket isn\'t in progress (expected)',
        throwError: true
      })
    }

    console.log('create arbiter')
    await contracts.escrow.addarbiter(thirduser, { authorization: `${escrow}@active` })

    console.log('add arbiter to arbitrage')
    await contracts.escrow.arbtrgeoffer(thirduser, 1, { authorization: `${thirduser}@active` })

    const offersB = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    let currSellOffBefore = offersB.rows[0]

    const balancesB = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })

    console.log('Balances before')

    assert.deepEqual(balancesB.rows[0], {
      account: firstuser,
      available_balance: '0.0000 SEEDS',
      swap_balance: '0.0000 SEEDS',
      escrow_balance: '1000.0000 SEEDS'
    })

    let availabeBefore = currSellOffBefore.quantity_info.find(el => el.key === 'available').value
    let totalOfferedBefore = currSellOffBefore.quantity_info.find(el => el.key === 'totaloffered').value

    const balances = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })

    console.log('Seller balance before resolve buyoffer 1')
    assert.deepStrictEqual(balances.rows[0], {
      "account": firstuser,
      "available_balance": "0.0000 SEEDS",
      "swap_balance": "0.0000 SEEDS",
      "escrow_balance": "1000.0000 SEEDS"
    })

    await contracts.escrow.resolvesellr(1, "Resolved to seller", { authorization: `${thirduser}@active` })

    const arbitoffs = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'arbitoffs',
      json: true,
      limit: 100
    })

    delete arbitoffs.rows[0].created_date
    delete arbitoffs.rows[0].resolution_date
    assert.deepStrictEqual(arbitoffs.rows, [
      {
        "offer_id": 1,
        "arbiter": thirduser,
        "resolution": firstuser,
        "notes": "Resolved to seller",
        "seller_contact": [{
          "key": firstuser,
          "value": 0
        }],
        "buyer_contact": [{
          "key": seconduser,
          "value": 0
        }]
      }
    ])

    const balances2 = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })

    console.log('Seller balance confirm payment of buyoffer 2')
    assert.deepStrictEqual(balances2.rows[0], {
      "account": firstuser,
      "available_balance": "0.0000 SEEDS",
      "swap_balance": "500.0000 SEEDS",
      "escrow_balance": "500.0000 SEEDS"
    })

    await contracts.escrow.confrmpaymnt(2, { authorization: `${firstuser}@active` })

    const balancesAf = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(balancesAf.rows[0], {
      "account": firstuser,
      "available_balance": "0.0000 SEEDS",
      "swap_balance": "500.0000 SEEDS",
      "escrow_balance": "0.0000 SEEDS"
    })

    const offers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    let currBuyOff = offers.rows[1]
    let currSellOff = offers.rows[0]
    let flaggedStatus = currBuyOff.status_history.find(el => el.key === 'b.flagged')

    let availabeAfter = currSellOff.quantity_info.find(el => el.key === 'available').value
    let totalOffered = currSellOff.quantity_info.find(el => el.key === 'totaloffered').value

    assert.deepStrictEqual(availabeBefore, '0.0000 SEEDS')
    assert.deepStrictEqual(availabeAfter, '500.0000 SEEDS')
    assert.deepStrictEqual(totalOffered, '1000.0000 SEEDS')

    console.log('Buy offer is marked as flagged ')
    assert.deepStrictEqual(flaggedStatus.key, 'b.flagged')
  })

  it('Resolve buyer', async function () {
    console.log('transafer tokens')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })

    console.log('add, accept and pay offers')
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })

    await contracts.escrow.addbuyoffer(seconduser, 0, '500.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.addbuyoffer(thirduser, 0, '500.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })

    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })
    await contracts.escrow.accptbuyoffr(2, { authorization: `${firstuser}@active` })

    await contracts.escrow.payoffer(1, { authorization: `${seconduser}@active` })
    await contracts.escrow.payoffer(2, { authorization: `${thirduser}@active` })

    try {
      await contracts.escrow.resolvebuyer(1, "", { authorization: `${thirduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'arbitrage does not exist',
        message: 'arbitrage does not exist (expected)',
        throwError: true
      })
    }

    console.time('sleep4')
    await sleep(2000)
    console.timeLog('sleep4')

    console.log('create arbitrage')
    await setParamsValue(true)
    await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })

    try {
      await contracts.escrow.resolvebuyer(1, "", { authorization: `${thirduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'this arbitration ticket isn\'t in progress',
        message: 'this arbitration ticket isn\'t in progress (expected)',
        throwError: true
      })
    }

    console.log('create arbiter')
    await contracts.escrow.addarbiter(thirduser, { authorization: `${escrow}@active` })

    console.log('add arbiter to arbitrage')
    await contracts.escrow.arbtrgeoffer(thirduser, 1, { authorization: `${thirduser}@active` })

    const firstuserBalanceBefore = await getAccountBalance(seedsContracts.token, seconduser, seedsSymbol)

    await contracts.escrow.confrmpaymnt(2, { authorization: `${firstuser}@active` })

    const offers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    let currSellOff = offers.rows.find(el => el.id === 0)
    assert.deepStrictEqual(currSellOff.current_status, 's.soldout')

    await contracts.escrow.resolvebuyer(1, "Resolved to buyer", { authorization: `${thirduser}@active` })

    const offersAf = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    console.log('Sell offer is s.successful because all other buy offers are as b.success and buy offer was resolved to buyer')
    let currSellOffAf = offersAf.rows.find(el => el.id === 0)
    assert.deepStrictEqual(currSellOffAf.current_status, 's.successful')

    let currBuyOfferA = offersAf.rows.find(el => el.id === 1)
    let succStatusA = currBuyOfferA.status_history.find(el => el.key === 'b.success')

    assert.deepStrictEqual(currBuyOfferA.current_status, 'b.success')
    assert.notDeepStrictEqual(succStatusA.value, 'b.success')

    const arbitoffs = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'arbitoffs',
      json: true,
      limit: 100
    })

    delete arbitoffs.rows[0].created_date
    delete arbitoffs.rows[0].resolution_date
    assert.deepStrictEqual(arbitoffs.rows, [
      {
        "offer_id": 1,
        "arbiter": thirduser,
        "resolution": `${seconduser}`,
        "notes": "Resolved to buyer",
        "seller_contact": [{
          "key": firstuser,
          "value": 0
        }],
        "buyer_contact": [{
          "key": seconduser,
          "value": 0
        }]
      }
    ])

    const balances = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(balances.rows, [
      {
        "account": "seedsuseraaa",
        "available_balance": "0.0000 SEEDS",
        "swap_balance": "0.0000 SEEDS",
        "escrow_balance": "0.0000 SEEDS"
      }
    ])

    const firstuserBalanceAfter = await getAccountBalance(seedsContracts.token, seconduser, seedsSymbol)

    assert.deepStrictEqual(firstuserBalanceAfter - firstuserBalanceBefore, 500.0)

    const trxStats = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'trxstats',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(trxStats.rows, [
      {
        "account": firstuser,
        "total_trx": 1,
        "sell_successful": 1,
        "buy_successful": 0
      },
      {
        "account": seconduser,
        "total_trx": 1,
        "sell_successful": 0,
        "buy_successful": 1
      },
      {
        "account": thirduser,
        "total_trx": 1,
        "sell_successful": 0,
        "buy_successful": 1
      }
    ])
  })

  it('Resolve seller', async function () {
    console.log('transafer tokens')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })

    console.log('add, accept and pay offers')
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })
    await contracts.escrow.addbuyoffer(seconduser, 0, '1000.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })
    await contracts.escrow.payoffer(1, { authorization: `${seconduser}@active` })

    try {
      await contracts.escrow.resolvesellr(1, "", { authorization: `${thirduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'arbitrage does not exist',
        message: 'arbitrage does not exist (expected)',
        throwError: true
      })
    }

    console.time('sleep3')
    await sleep(2000)
    console.timeLog('sleep3')

    console.log('create arbitrage')
    await setParamsValue(true)
    await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })

    try {
      await contracts.escrow.resolvesellr(1, "", { authorization: `${thirduser}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'this arbitration ticket isn\'t in progress',
        message: 'this arbitration ticket isn\'t in progress (expected)',
        throwError: true
      })
    }

    console.log('create arbiter')
    await contracts.escrow.addarbiter(thirduser, { authorization: `${escrow}@active` })

    console.log('add arbiter to arbitrage')
    await contracts.escrow.arbtrgeoffer(thirduser, 1, { authorization: `${thirduser}@active` })

    const offersB = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    let currSellOffBefore = offersB.rows[0]

    let availabeBefore = currSellOffBefore.quantity_info.find(el => el.key === 'available').value
    let totalOfferedBefore = currSellOffBefore.quantity_info.find(el => el.key === 'totaloffered').value

    await contracts.escrow.resolvesellr(1, "Resolved to seller", { authorization: `${thirduser}@active` })

    const arbitoffs = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'arbitoffs',
      json: true,
      limit: 100
    })

    delete arbitoffs.rows[0].created_date
    delete arbitoffs.rows[0].resolution_date
    assert.deepStrictEqual(arbitoffs.rows, [
      {
        "offer_id": 1,
        "arbiter": "seedsuserccc",
        "resolution": `${firstuser}`,
        "notes": "Resolved to seller",
        "seller_contact": [{
          "key": firstuser,
          "value": 0
        }],
        "buyer_contact": [{
          "key": seconduser,
          "value": 0
        }]
      }
    ])

    const balances = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'balances',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(balances.rows[0], {
      "account": "seedsuseraaa",
      "available_balance": "0.0000 SEEDS",
      "swap_balance": "1000.0000 SEEDS",
      "escrow_balance": "0.0000 SEEDS"
    })

    const offers = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    let currBuyOff = offers.rows[1]
    let currSellOff = offers.rows[0]
    let flaggedStatus = currBuyOff.status_history.find(el => el.key === 'b.flagged')

    let availabeQuantity = currSellOff.quantity_info.find(el => el.key === 'available').value
    let totalOffered = currSellOff.quantity_info.find(el => el.key === 'totaloffered').value

    assert.deepStrictEqual(availabeBefore, '0.0000 SEEDS')
    assert.deepStrictEqual(totalOfferedBefore, '1000.0000 SEEDS')
    assert.deepStrictEqual(availabeQuantity, '1000.0000 SEEDS')
    assert.deepStrictEqual(totalOffered, '1000.0000 SEEDS')
    assert.deepStrictEqual(currBuyOff.current_status, 'b.flagged')
    assert.deepStrictEqual(flaggedStatus.key, 'b.flagged')
  })

  it('On confirm payment and it is soldout => it should mark sell off as success', async function () {
    console.log('transafer tokens')
    await seeds.token.transfer(firstuser, escrow, '2000.0000 SEEDS', '', { authorization: `${firstuser}@active` })

    console.log('add, accept and pay offers')
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })

    await contracts.escrow.addbuyoffer(seconduser, 0, '500.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.addbuyoffer(thirduser, 0, '500.0000 SEEDS', 'paypal', { authorization: `${thirduser}@active` })

    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })

    console.log('Confirm to sell half of offered seeds')
    const offersTable1 = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(offersTable1.rows[0].current_status, 's.active')

    await contracts.escrow.accptbuyoffr(2, { authorization: `${firstuser}@active` })

    console.log('Confirm to sell half of offered seeds')
    const offersTable2 = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(offersTable2.rows[0].current_status, 's.soldout')

    await contracts.escrow.payoffer(1, { authorization: `${seconduser}@active` })
    await contracts.escrow.confrmpaymnt(1, { authorization: `${firstuser}@active` })

    const offersTable = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(offersTable.rows[0].current_status, 's.soldout')

    await contracts.escrow.payoffer(2, { authorization: `${thirduser}@active` })
    await contracts.escrow.confrmpaymnt(2, { authorization: `${firstuser}@active` })

    const offersTable3 = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'offers',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(offersTable3.rows[0].current_status, 's.successful')
  })

  it('Settings, set a new param', async function () {
    await contracts.escrow.setparam('testparam', ['uint64', 20], 'test param', { authorization: `${escrow}@active` })

    const settingsParam = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'config',
      json: true,
      limit: 100
    })

    console.log(JSON.stringify(settingsParam, null, 2))
  })

  it('Send contact methods to arbiter', async function () {
    console.log('transafer tokens')
    await seeds.token.transfer(firstuser, escrow, '1000.0000 SEEDS', '', { authorization: `${firstuser}@active` })

    console.log('add, accept and pay offers')
    await contracts.escrow.addselloffer(firstuser, '1000.0000 SEEDS', 11000, { authorization: `${firstuser}@active` })
    await contracts.escrow.addbuyoffer(seconduser, 0, '1000.0000 SEEDS', 'paypal', { authorization: `${seconduser}@active` })
    await contracts.escrow.accptbuyoffr(1, { authorization: `${firstuser}@active` })

    console.log('Buyer don\'t confirm pay so seller init arbitrage')
    await contracts.escrow.initarbitrage(1, { authorization: `${firstuser}@active` })

    console.log('create arbiter')
    await contracts.escrow.addarbiter(thirduser, { authorization: `${escrow}@active` })

    try {
      await contracts.escrow.sendconmethd(1, '4251f90f2a58a4cf78bf70f95e4f772f', 'PUB_K1_6utVJ2S4zHZCiJvTxDhRVUst5RM5zB8foUaCEqEw34dz9wFh5v', '69e4210d9a46daf32bb01bd999770d23f5953b030ea53c93dd7e8f881907d57d', 'a350ac97f1d22e7cb2abaa4ab47a626768d0835e5aa2f6a7ed140bcd46d50165', { authorization: `${firstuser}@active` })
    } catch (error) {
      assert.deepStrictEqual(error.message, 'assertion failure with message: Offer has not arbiter yet')
    }

    console.log('add arbiter to arbitrage')
    await contracts.escrow.arbtrgeoffer(thirduser, 1, { authorization: `${thirduser}@active` })

    console.log('seller send contact methods')
    await contracts.escrow.sendconmethd(1, '4251f90f2a58a4cf78bf70f95e4f772f', 'PUB_K1_6utVJ2S4zHZCiJvTxDhRVUst5RM5zB8foUaCEqEw34dz9wFh5v', '69e4210d9a46daf32bb01bd999770d23f5953b030ea53c93dd7e8f881907d57d', 'a350ac97f1d22e7cb2abaa4ab47a626768d0835e5aa2f6a7ed140bcd46d50165', { authorization: `${firstuser}@active` })

    console.log('buyer send contact methods')
    await contracts.escrow.sendconmethd(1, '4251f90f2a58a4cf78bf70f95e4f772f', 'PUB_K1_6utVJ2S4zHZCiJvTxDhRVUst5RM5zB8foUaCEqEw34dz9wFh5v', '69e4210d9a46daf32bb01bd999770d23f5953b030ea53c93dd7e8f881907d57d', 'a350ac97f1d22e7cb2abaa4ab47a626768d0835e5aa2f6a7ed140bcd46d50165', { authorization: `${seconduser}@active` })

    const arbitragesTable = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'arbitoffs',
      json: true,
      limit: 100
    })

    delete arbitragesTable.rows[0].created_date
    delete arbitragesTable.rows[0].resolution_date

    assert.deepStrictEqual(arbitragesTable.rows[0], {
      "offer_id": 1,
      "arbiter": thirduser,
      "resolution": "a.inprogress",
      "notes": "",
      "seller_contact": [{
        "key": firstuser,
        "value": 1
      }],
      "buyer_contact": [{
        "key": seconduser,
        "value": 1
      }]
    })

    const messagesTable = await rpc.get_table_rows({
      code: escrow,
      scope: escrow,
      table: 'pmessages',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(messagesTable.rows, [
      {
        id: 0,
        buy_offer_id: 1,
        sender: firstuser,
        receiver: thirduser,
        iv: '4251f90f2a58a4cf78bf70f95e4f772f',
        ephem_key: 'PUB_K1_6utVJ2S4zHZCiJvTxDhRVUst5RM5zB8foUaCEqEw34dz9wFh5v',
        message: '69e4210d9a46daf32bb01bd999770d23f5953b030ea53c93dd7e8f881907d57d',
        mac: 'a350ac97f1d22e7cb2abaa4ab47a626768d0835e5aa2f6a7ed140bcd46d50165'
      },
      {
        id: 1,
        buy_offer_id: 1,
        sender: seconduser,
        receiver: thirduser,
        iv: '4251f90f2a58a4cf78bf70f95e4f772f',
        ephem_key: 'PUB_K1_6utVJ2S4zHZCiJvTxDhRVUst5RM5zB8foUaCEqEw34dz9wFh5v',
        message: '69e4210d9a46daf32bb01bd999770d23f5953b030ea53c93dd7e8f881907d57d',
        mac: 'a350ac97f1d22e7cb2abaa4ab47a626768d0835e5aa2f6a7ed140bcd46d50165'
      }
    ])
  })

  it('Reset settings', async function () {
    await contracts.escrow.resetsttngs({ authorization: `${escrow}@active` })
  })
})
