function assertError ({ error, textInside, message=null, throwError=false }) {

  let eosErrorMessage
  try {
    eosErrorMessage = error.json.error.details[0].message
  } catch (err) {
    throw error
  }

  if (eosErrorMessage.toLowerCase().includes(textInside.toLowerCase())) {
    const msg = message || eosErrorMessage
    console.log(msg)
    return msg
  }

  if (throwError) {
    throw Error(eosErrorMessage)
  } else {
    console.log(eosErrorMessage)
    return eosErrorMessage
  }

}

function accountExists (error) {
  return assertError({
    error,
    textInside: 'as that name is already taken',
    message: 'account already exists',
    throwError: true
  })
}

function contractRunningSameCode (error) {
  return assertError({
    error,
    textInside: 'contract is already running this version of code',
    message: 'no changes to apply to the contract',
    throwError: true
  })
}

module.exports = {
  assertError,
  accountExists,
  contractRunningSameCode
}
