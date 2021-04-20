#include <eosio/eosio.hpp>
#include <util.hpp>

using eosio::name;
using std::string;

#define DEFINE_CHECK_USER \
  void check_user (name account) { \
    auto uitr = users.find(account.value); \
    check(uitr != users.end(), "user not found"); \
  }
