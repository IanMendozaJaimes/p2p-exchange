const { rpc, transact } = require('./eos')
const { contractNames } = require('./config')
const { escrow } = contractNames

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

async function send ({
  senderAccount,
  recipientAccount,
  message
}) {

  let rcptKey = null

  const accountInfo = await rpc.get_account(recipientAccount)

  // Here we look for the recipient's public
  // accountInfo.permissions.forEach(function(perm) {
  //   if(perm.perm_name == 'active') {
  //     if( perm.required_auth.keys.length > 1 ) {
  //       throw('Found more than one key in active permissoin of ' + program.recipient)
  //     }
  //     rcptKey = perm.required_auth.keys[0].key
  //   }
  // })

  // for this example, let's use a fixed public key:
  rcptKey = 'EOS5wZGoq4PQNWeAi6hDzVoFjZWEFwhZxAnmLZ8vWV8o2fRn8uiGh'

  rcptKey = PublicKey.fromString(rcptKey).toElliptic()

  // create the ephemeral key pair
  const ephemKey = new EC('secp256k1').genKeyPair()
  const ephemPublicKey = PublicKey.fromElliptic(ephemKey, KeyType.k1)
  
  // obtaining the shared secret
  const shared = Buffer.from(ephemKey.derive(rcptKey.getPublic()).toString('hex'), 'hex')
  const hash = new shajs.sha512().update(shared).digest()

  let iv = crypto.randomBytes(16) // initialization vector
  let encryptionKey = hash.slice(0, 32)
  let macKey = hash.slice(32)

  let cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv)
  let firstChunk = cipher.update(message)
  let secondChunk = cipher.final()
  let ciphertext = Buffer.concat([firstChunk, secondChunk])

  let dataToMac = Buffer.concat([iv, ephemPublicKey.key.data, ciphertext])
  let mac = crypto.createHmac("sha256", macKey).update(dataToMac).digest()

  console.log({
    from: senderAccount,
    to: recipientAccount,
    iv: iv.toString('hex'),
    ephem_key: ephemPublicKey.toString(),
    ciphertext: ciphertext.toString('hex'),
    mac: mac.toString('hex')
  })
  
  const res = await transact({
    actions:[
      {
        account: escrow,
        name: 'send',
        authorization: [{
          actor: senderAccount,
          permission: 'active'
        }],
        data: {
          from: senderAccount,
          to: recipientAccount,
          iv: iv.toString('hex'),
          ephem_key: ephemPublicKey.toString(),
          message: ciphertext.toString('hex'),
          mac: mac.toString('hex')
        }
      }
    ]
  })

  console.log(res)

}

send({
  senderAccount: testuser1,
  recipientAccount: testuser2,
  message: 'hello, this is a test message'
})
