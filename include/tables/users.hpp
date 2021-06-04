#include <eosio/eosio.hpp>
#include <util.hpp>

using eosio::name;
using std::string;

#define DEFINE_USERS_TABLE TABLE user_table { \
      name account; \
      mapss contact_methods; \
      mapss payment_methods; \
      name time_zone; \
      name fiat_currency; \
      bool is_arbiter; \
\
      uint64_t primary_key () const { return account.value; } \
      uint64_t by_timezone () const { return time_zone.value; } \
      uint64_t by_currency () const { return fiat_currency.value; } \
    }; \
\
    typedef eosio::multi_index<"users"_n, user_table, \
      indexed_by<"bytimezone"_n, \
      const_mem_fun<user_table, uint64_t, &user_table::by_timezone>>, \
      indexed_by<"bycurrency"_n, \
      const_mem_fun<user_table, uint64_t, &user_table::by_currency>> \
    > user_tables;

