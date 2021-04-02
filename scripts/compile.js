require('dotenv').config()

const { exec } = require('child_process')
const { promisify } = require('util')
const fs = require('fs')
const { join } = require('path')

const execCommand = promisify(exec)

async function deleteFile (filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
} 

async function compileContract ({
  contract,
  path
}) {

  const compiled = join(__dirname, '../compiled')
  let cmd = ""
  
  if (process.env.COMPILER === 'local') {
    cmd = `eosio-cpp -abigen -I ./include -contract ${contract} -o ./compiled/${contract}.wasm ${path}`
  } else {
    cmd = `docker run --rm --name eosio.cdt_v1.6.1 --volume ${join(__dirname, '../')}:/project -w /project eostudio/eosio.cdt:v1.6.1 /bin/bash -c "echo 'starting';eosio-cpp -abigen -I ./include -contract ${contract} -o ./compiled/${contract}.wasm ${path}"`
  }
  console.log("compiler command: " + cmd, '\n')

  if (!fs.existsSync(compiled)) {
    fs.mkdirSync(compiled)
  }

  await deleteFile(join(compiled, `${contract}.wasm`))
  await deleteFile(join(compiled, `${contract}.abi`))

  await execCommand(cmd)

}

module.exports = { compileContract }
