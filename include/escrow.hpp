#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>
#include <contracts.hpp>
#include <tables/users.hpp>
#include <tables/seeds.prices.hpp>
#include <config.hpp>
#include <util.hpp>
#include <common.hpp>

using namespace eosio;

CONTRACT escrow : public contract {

  public:
    using contract::contract;
    escrow(name receiver, name code, datastream<const char*> ds)
      : contract(receiver, code, ds),
        config(contracts::settings, contracts::settings.value)
        {}

    ACTION reset();

    ACTION resetoffers();

    ACTION deposit(const name & from, const name & to, const asset & quantity, const std::string & memo);

    ACTION withdraw(const name & account, const asset & quantity);

    ACTION upsertuser(const name & account, const mapss & contact_methods, const mapss & payment_methods, const name & time_zone, const name & fiat_currency);

    ACTION addselloffer(const name & seller, const asset & total_offered, const uint64_t & price_percentage);

    ACTION cancelsoffer(const uint64_t & sell_offer_id);

    ACTION addbuyoffer(const name & buyer, const uint64_t & sell_offer_id, const asset & quantity, const std::string & payment_method);

    ACTION delbuyoffer(const uint64_t & buy_offer_id);

    ACTION accptbuyoffr(const uint64_t & buy_offer_id);

    ACTION payoffer(const uint64_t & buy_offer_id);

    ACTION confrmpaymnt(const uint64_t & buy_offer_id);

    ACTION addarbiter(const name & account);

    ACTION delarbiter(const name & account);

    ACTION initarbitrage(const uint64_t & buy_offer_id);

    ACTION arbtrgeoffer(const & name arbiter, const & uint64_t & offer_id);

    ACTION resolvesellr(const & uint64_t & offer_id);

    ACTION resolvebuyer(const & uint64_t & offer_id);

  private:

    const name offer_type_sell = name("offer.sell");
    const name offer_type_buy = name("offer.buy");

    const name sell_offer_status_active = name("s.active");
    const name sell_offer_status_soldout = name("s.soldout");
    const name sell_offer_status_canceled = name("s.canceled");

    const name buy_offer_status_pending = name("b.pending");
    const name buy_offer_status_accepted = name("b.accepted");
    const name buy_offer_status_paid = name("b.paid");
    const name buy_offer_status_confirmed = name("b.confirmd");
    const name buy_offer_status_successful = name("b.success");
    const name buy_offer_status_arbitrage = name("b.arbitrage");

    DEFINE_CONFIG_TABLE
    DEFINE_CONFIG_GET

    DEFINE_USERS_TABLE

    DEFINE_SEEDS_PRICE_TABLE
    DEFINE_SEEDS_PRICE_MULTI_INDEX

    TABLE balances_table {
      name account;
      asset available_balance;
      asset swap_balance;
      asset escrow_balance;

      uint64_t primary_key () const { return account.value; }
    };

    TABLE transactions_stats_table {
      name account;
      uint64_t total_trx;
      uint64_t sell_successful;
      uint64_t buy_successful; // does it make any difference?

      uint64_t primary_key () const { return account.value; }
      uint128_t by_total_account () const { return (uint128_t(total_trx) << 64) + account.value; }
      uint128_t by_sell_account () const { return (uint128_t(sell_successful) << 64) + account.value; }
      uint128_t by_buy_account () const { return (uint128_t(buy_successful) << 64) + account.value; }
    };

    TABLE offer_table {
      uint64_t id;
      name seller;
      name buyer;
      name type;
      mapna quantity_info;
      mapnui64 price_info;
      time_point created_date;
      mapnt status_history;
      mapss payment_methods;
      name current_status;
      name time_zone;
      name fiat_currency;

      uint64_t primary_key () const { return id; }
      uint64_t by_date () const { return std::numeric_limits<uint64_t>::max() - created_date.sec_since_epoch(); }
      uint128_t by_type_id () const { return (uint128_t(type.value) << 64) + id; }
      uint128_t by_seller_id () const { return (uint128_t(seller.value) << 64) + id; }
      uint128_t by_seller_date () const { return (uint128_t(seller.value) << 64) + (std::numeric_limits<uint64_t>::max() - created_date.sec_since_epoch()); }
      uint128_t by_buyer_id () const { return (uint128_t(buyer.value) << 64) + id; }
      uint128_t by_buyer_date () const { return (uint128_t(buyer.value) << 64) + (std::numeric_limits<uint64_t>::max() - created_date.sec_since_epoch()); }
      uint128_t by_current_status_seller () const { return (uint128_t(current_status.value) << 64) + seller.value; }
      uint128_t by_current_status_buyer () const { return (uint128_t(current_status.value) << 64) + buyer.value; }
      uint128_t by_current_status_id () const { return (uint128_t(current_status.value) << 64) + id; }
      uint128_t by_current_status_date () const { return (uint128_t(current_status.value) << 64) + (std::numeric_limits<uint64_t>::max() - created_date.sec_since_epoch()); }
      uint128_t by_current_status_timezone () const { 
        uint128_t index_high = (uint128_t(current_status.value) << 64) + (uint128_t(time_zone.value << 64));
        return index_high + id; 
      }
      uint128_t by_current_status_currency () const { 
        uint128_t index_high = (uint128_t(current_status.value) << 64) + (uint128_t(fiat_currency.value << 64));
        return index_high + id; 
      }
    };

    typedef eosio::multi_index<name("offers"), offer_table,
      indexed_by<name("bydate"),
      const_mem_fun<offer_table, uint64_t, &offer_table::by_date>>,
      indexed_by<name("bytypeid"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_type_id>>,
      indexed_by<name("bysellerid"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_seller_id>>,
      indexed_by<name("bysellerdate"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_seller_date>>,
      indexed_by<name("bybuyerid"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_buyer_id>>,
      indexed_by<name("bybuyerdate"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_buyer_date>>,
      indexed_by<name("bycstatuss"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_current_status_seller>>,
      indexed_by<name("bycstatusb"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_current_status_buyer>>,
      indexed_by<name("bycstatusid"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_current_status_id>>,
      indexed_by<name("bystatusdate"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_current_status_date>>,
      indexed_by<name("bystimezone"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_current_status_timezone>>,
      indexed_by<name("byscurrency"),
      const_mem_fun<offer_table, uint128_t, &offer_table::by_current_status_currency>>
    > offer_tables;

    TABLE buy_sell_relation_table {
      uint64_t id;
      uint64_t sell_offer_id;
      uint64_t buy_offer_id;

      uint64_t primary_key () const { return id; }
      uint64_t by_buy () const { return buy_offer_id; }
      uint128_t by_sell_buy () const { return (uint128_t(sell_offer_id) << 64) + buy_offer_id; }
    };

    typedef eosio::multi_index<name("balances"), balances_table> balances_tables;

    typedef eosio::multi_index<name("trxstats"), transactions_stats_table,
      indexed_by<name("bytotalacct"),
      const_mem_fun<transactions_stats_table, uint128_t, &transactions_stats_table::by_total_account>>,
      indexed_by<name("bysellacct"),
      const_mem_fun<transactions_stats_table, uint128_t, &transactions_stats_table::by_sell_account>>,
      indexed_by<name("bybuyacct"),
      const_mem_fun<transactions_stats_table, uint128_t, &transactions_stats_table::by_buy_account>>
    > transactions_stats_tables;

    typedef eosio::multi_index<name("buysellrel"), buy_sell_relation_table,
      indexed_by<name("bybuy"),
      const_mem_fun<buy_sell_relation_table, uint64_t, &buy_sell_relation_table::by_buy>>,
      indexed_by<name("bysellbuy"),
      const_mem_fun<buy_sell_relation_table, uint128_t, &buy_sell_relation_table::by_sell_buy>>
    > buy_sell_relation_tables;


    config_tables config;

    void send_transfer(const name & beneficiary, const asset & quantity, const std::string & memo);
    void add_success_transaction(const name & account, const name & trx_type);

    TABLE arbitrage_offers_table {
      uint64_t offer_id;
      name arbiter;
      name resolution;
      string notes;
      time_point created_date;
      time_point resolution_date;

      uint64_t primary_key () const { return offer_id; }
      uint128_t by_created_date_id () const { return uint128_t(created_date.sec_since_epoch() << 64) + offer_id; }
      uint128_t by_resolution_id () const { return (uint128_t(resolution.value) << 64) + offer_id; }
      uint128_t by_arbiter_id () const { return (uint128_t(arbiter.value) << 64) + offer_id; }
    };

    typedef eosio::multi_index<name("arbitoffs"), arbitrage_offers_table,
      indexed_by<name("bycrtddate"),
      const_mem_fun<arbitrage_offers_table, uint128_t, &arbitrage_offers_table::by_created_date_id>>,
      indexed_by<name("byresid"),
      const_mem_fun<arbitrage_offers_table, uint128_t, &arbitrage_offers_table::by_resolution_id>>,
      indexed_by<name("byarbitid"),
      const_mem_fun<arbitrage_offers_table, uint128_t, &arbitrage_offers_table::by_arbiter_id>>
    > arbitrage_tables;

    typedef singleton<"price"_n, price_table> price_tables;
};

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  if (action == name("transfer").value && code == seeds::token.value) {
      execute_action<escrow>(name(receiver), name(code), &escrow::deposit);
  } else if (code == receiver) {
      switch (action) {
          EOSIO_DISPATCH_HELPER(escrow,
          (reset)(resetoffers)
          (withdraw)
          (upsertuser)
          (addselloffer)(cancelsoffer)
          (addbuyoffer)(delbuyoffer)
          (accptbuyoffr)(payoffer)(confrmpaymnt)
          (addarbiter)(delarbiter)
          (initarbitrage)
        )
      }
  }
}
