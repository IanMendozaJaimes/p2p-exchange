#include <eosio/eosio.hpp>

using eosio::name;

#define DEFINE_SEEDS_PRICE_TABLE TABLE price_table { \
        uint64_t id; \
        uint64_t current_round_id; \
        asset current_seeds_per_usd; \
        uint64_t remaining; \
\
        uint64_t primary_key()const { return id; } \
      }; \

#define DEFINE_SEEDS_PRICE_MULTI_INDEX typedef eosio::multi_index<"price"_n, price_table \
> dump_for_price; \
