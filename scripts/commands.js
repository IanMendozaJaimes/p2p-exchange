const { contracts, publicKeys, owner, chain, sleep, isLocalNode } = require('./config')
const { compileContract } = require('./compile')
const { createAccount, deployContract } = require('./deploy')
const { accountExists, contractRunningSameCode } = require('./eosio-errors')
const { setParamsValue } = require('./contract-settings')
const { updatePermissions } = require('./permissions')
const prompt = require('prompt-sync')()


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

  console.log('UPDATE PERMISSIONS\n')
  await updatePermissions()
  console.log('update permissions finished\n\n')

  console.log('SETTING CONTRACTS PARAMETERS\n')
  await setParamsValue()
  console.log('setting parameters finished\n\n')

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

  if (!isLocalNode()) {
    const option = prompt(`You are about to run a command on ${chain}, are you sure? [y/n] `)
    if (option.toLowerCase() !== 'y') { return }
  }

  const args = process.argv.slice(2)

  if (args[0] === 'init') {
    await init()
  } else if (args[0] == 'run') {
    await run(args[1])
  } else if (args[0] == 'set') {
    if (args[1] == 'params') {
      await setParamsValue()
    } else if (args[1] == 'permissions') {
      await updatePermissions()
    }
  }

}

main()
