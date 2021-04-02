#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <util.hpp>
#include <config.hpp>

using namespace eosio;
using std::string;

CONTRACT settings : public contract {
  
  public:
    using contract::contract;
    settings(name receiver, name code, datastream<const char*> ds)
      : contract(receiver, code, ds),
        config(receiver, receiver.value)
        {}

    ACTION reset();

    ACTION setparam(name key, SettingsValues value, string description);
  
  private:

    DEFINE_CONFIG_TABLE

    config_tables config;
  
};

EOSIO_DISPATCH(settings, (reset)(setparam));
