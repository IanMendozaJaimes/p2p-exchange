#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

using namespace eosio;
using std::string;

CONTRACT nullcontract : public contract {
  
  public:
    using contract::contract;
    nullcontract(name receiver, name code, datastream<const char*> ds)
      : contract(receiver, code, ds)
        {}

    ACTION nonce(string random);
};

EOSIO_DISPATCH(nullcontract, (nonce));
