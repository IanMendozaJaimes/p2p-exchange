#pragma once

#include <eosio/name.hpp>
#include <eosio/asset.hpp>
#include <tables/seeds.users.hpp>
#include <contracts.hpp>
#include <variant>

using namespace eosio;
using std::string;

namespace util
{
  const symbol seeds_symbol = symbol("SEEDS", 4);

  constexpr name seeds_visitor_status = name("visitor");
  constexpr name seeds_resident_status = name("resident");
  constexpr name seeds_citizen_status = name("citizen");

  void check_asset(asset quantity)
  {
    check(quantity.symbol == seeds_symbol, "invalid symbol");
    check(quantity.amount > 0, "quantity must be greater than 0");
  }

  void check_seeds_user_status(const name & account, const name & min_status)
  {
    DEFINE_SEEDS_USER_TABLE
    DEFINE_SEEDS_USER_TABLE_MULTI_INDEX

    user_tables seeds_users(seeds::accounts, seeds::accounts.value);

    auto uitr = seeds_users.find(account.value);
    check(uitr != seeds_users.end(), account.to_string() + " account is not a seeds user");
    
    switch(min_status)
    {
      case seeds_resident_status:
        check(uitr->status == seeds_resident_status || uitr->status == seeds_citizen_status,
          "user must be at least a " + min_status.to_string());
        break;
      case seeds_citizen_status:
        check(uitr->status == seeds_citizen_status, "user must be at least a " + min_status.to_string());
        break;
    }
  }
}
