const { contracts, publicKeys, owner, sleep } = require('./config')
const { compileContract } = require('./compile')
const { createAccount, deployContract } = require('./deploy')
const { accountExists, contractRunningSameCode } = require('./eosio-errors')


async function manageDeployment (contract) {
  console.log('create account:', contract.nameOnChain)
  try {
    await createAccount({
      account: contract.nameOnChain,
      publicKey: publicKeys.active,
      stakes: contract.stakes,
      creator: owner
    })
  } catch (err) {
    accountExists(err)
  }
  console.log('deploy contract for:', contract.nameOnChain)
  try {
    await deployContract(contract)
  } catch (err) {
    contractRunningSameCode(err)
  }
  console.log('done\n')
}

async function init () {

  // compile contracts
  console.log('COMPILING CONTRACTS\n')

  await Promise.all(contracts.map(contract => {
    return compileContract({
      contract: contract.name,
      path: `./src/${contract.name}.cpp`      
    })
  }))

  console.log('compilation finished\n\n')

  // deploy contracts
  console.log('DEPLOYING CONTRACTS\n')

  for (const contract of contracts) {
    await manageDeployment(contract)
    await sleep(1000)
  }

  console.log('deployment finished\n\n')

}

async function run (contractName) {

  let contract = contracts.filter(c => c.name == contractName)
  if (contract.length > 0) {
    contract = contract[0]
  } else {
    console.log('contract not found')
    return
  }

  await compileContract({
    contract: contract.name,
    path: `./src/${contract.name}.cpp`      
  })

  await manageDeployment(contract)

}

async function main () {

  const args = process.argv.slice(2)

  if (args[0] === 'init') {
    await init()
  } else if (args[0] == 'run') {
    await run(args[1])
  }

}

main()
