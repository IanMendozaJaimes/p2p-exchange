const { rpc, transact } = require('./eos')
const { contractNames } = require('./config')
const { escrow } = contractNames

const { PrivateKey } = require('eosjs/dist/PrivateKey')
const { PublicKey } = require('eosjs/dist/PublicKey')
const { KeyType } = require('eosjs/dist/eosjs-numeric')

const EC = require('elliptic').ec

const crypto = require('crypto')
const shajs = require('sha.js')


const testuser1 = 'm1p2ptestaaa'
const testuser2 = 'm1p2ptestbbb'

// this one should be the reader's private key stored in the wallet
// this key pair just serves as an example

// Private key: 5JSdx7E5u1uWMiiZREgzrBcGWnYfLnuMGHq7GcHq6RasYs2ovnB
// Public key: EOS5wZGoq4PQNWeAi6hDzVoFjZWEFwhZxAnmLZ8vWV8o2fRn8uiGh

const RECIPIENT_PRIVATE_KEY = '5JSdx7E5u1uWMiiZREgzrBcGWnYfLnuMGHq7GcHq6RasYs2ovnB'

async function read({
  senderAccount,
  recipientAccount,
  messageId
}) {

  const messagesTable = await rpc.get_table_rows({
    code: escrow,
    scope: escrow,
    table: 'privatemsgs',
    limit: 200,
    json: true
  })

  const messageRow = messagesTable.rows.filter(r => r.id === messageId)
  const message = messageRow[0]


  const rcptKey = PrivateKey.fromString(RECIPIENT_PRIVATE_KEY).toElliptic()

  let ephemPublicKey = PublicKey.fromString(message.ephem_key)
  let ephemKey = ephemPublicKey.toElliptic()
  let iv = Buffer.from(message.iv, 'hex')
  let ciphertext = Buffer.from(message.message, 'hex')
  let mac = Buffer.from(message.mac, 'hex')
  

  /****
   * 
    this is the operation the wallet should support in order to allow the encryption:
  
    rcptKey: is the receiver's private key

    ephemKey.getPublic(), returns the public key, you don't need the private key for this as the public key was obtained from the chain
 
    the "derive" operation is the multiplication between two points in an elliptic curve, then:

    sharedSecret = Bob_private * Ephemeral_public is this line  rcptKey.derive(ephemKey.getPublic())

    if the wallet could return this operation: rcptKey.derive(ephemKey.getPublic()), encryption in this way would be possible

  ****/


  let shared = Buffer.from(rcptKey.derive(ephemKey.getPublic()).toString('hex'), 'hex')
  


  // ------------------------------------------------------------------------------ //
  
  let hash = shajs('sha512').update(shared).digest()

  let encryptionKey = hash.slice(0, 32)
  let macKey = hash.slice(32)

  let dataToMac = Buffer.concat([iv, ephemPublicKey.key.data, ciphertext])
  let realMac = crypto.createHmac("sha256", macKey).update(dataToMac).digest()

  if(!realMac.equals(mac)) {
    console.error('Bad MAC')
  }
  else {
    let cipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv)
    let firstChunk = cipher.update(ciphertext)
    let secondChunk = cipher.final()
    let plaintext = Buffer.concat([firstChunk, secondChunk])

    console.log('plain text:', plaintext.toString())
  }

}

let messageId

if (process.argv.length < 3) {
  console.log('missing message id in the arguments, for this example, messageId = 0 is going to be used')
  messageId = 0
} else {
  messageId = parseInt(process.argv[2])
}

read({
  senderAccount: testuser1,
  recipientAccount: testuser2,
  messageId
})

