#include <escrow.hpp>
#include <tables/seeds.prices.hpp>

ACTION escrow::reset()
{
  require_auth(get_self());

  user_tables users_t(get_self(), get_self().value);
  auto uitr = users_t.begin();
  while (uitr != users_t.end())
  {
    uitr = users_t.erase(uitr);
  }

  balances_tables balances_t(get_self(), get_self().value);
  auto bitr = balances_t.begin();
  while (bitr != balances_t.end())
  {
    bitr = balances_t.erase(bitr);
  }

  transactions_stats_tables trx_stats_t(get_self(), get_self().value);
  auto titr = trx_stats_t.begin();
  while (titr != trx_stats_t.end())
  {
    titr = trx_stats_t.erase(titr);
  }

  offer_tables offers_t(get_self(), get_self().value);
  auto oitr = offers_t.begin();
  while (oitr != offers_t.end())
  {
    oitr = offers_t.erase(oitr);
  }

  buy_sell_relation_tables buy_sell_t(get_self(), get_self().value);
  auto bsritr = buy_sell_t.begin();
  while (bsritr != buy_sell_t.end())
  {
    bsritr = buy_sell_t.erase(bsritr);
  }

  arbitrage_tables arbitrage_offers_t(get_self(), get_self().value);
  auto aritr = arbitrage_offers_t.begin();
  while (aritr != arbitrage_offers_t.end())
  {
    aritr = arbitrage_offers_t.erase(aritr);
  }

  private_message_tables pmessages_t(get_self(), get_self().value);
  auto pmitr = pmessages_t.begin();
  while (pmitr != pmessages_t.end())
  {
    pmitr = pmessages_t.erase(pmitr);
  }

  user_public_key_tables public_t(get_self(), get_self().value);
  auto pitr = public_t.begin();
  while (pitr != public_t.end())
  {
    pitr = public_t.erase(pitr);
  }
}

ACTION escrow::resetoffers()
{
  require_auth(get_self());

  offer_tables offers_t(get_self(), get_self().value);
  auto oitr = offers_t.begin();
  while (oitr != offers_t.end())
  {
    oitr = offers_t.erase(oitr);
  }

  buy_sell_relation_tables buy_sell_t(get_self(), get_self().value);
  auto bsritr = buy_sell_t.begin();
  while (bsritr != buy_sell_t.end())
  {
    bsritr = buy_sell_t.erase(bsritr);
  }
}

ACTION escrow::resetsttngs()
{

  require_auth(get_self());

  auto citr = config.begin();
  while (citr != config.end())
  {
    citr = config.erase(citr);
  }
}

ACTION escrow::setparam(name key, SettingsValues value, string description)
{
  auto citr = config.find(key.value);
  if (citr == config.end())
  {
    config.emplace(_self, [&](auto &item)
                   {
                     item.key = key;
                     item.value = value;
                     if (description.length() > 0)
                     {
                       item.description = description;
                     }
                   });
  }
  else
  {
    config.modify(citr, _self, [&](auto &item)
                  {
                    item.value = value;
                    if (description.length() > 0)
                    {
                      item.description = description;
                    }
                  });
  }
}

ACTION escrow::deposit(const name &from, const name &to, const asset &quantity, const std::string &memo)
{
  if (get_first_receiver() == seeds::token && to == get_self() && from != get_self())
  {
    user_tables users_t(get_self(), get_self().value);
    auto uitr = users_t.find(from.value);
    check(uitr != users_t.end(), "user not found");

    util::check_seeds_user_status(from, util::seeds_resident_status);
    util::check_asset(quantity);

    balances_tables balances_t(get_self(), get_self().value);
    auto bitr = balances_t.find(from.value);

    if (bitr != balances_t.end())
    {
      balances_t.modify(bitr, _self, [&](auto &balance)
                        { balance.available_balance += quantity; });
    }
    else
    {
      balances_t.emplace(_self, [&](auto &balance)
                         {
                           balance.account = from;
                           balance.available_balance = quantity;
                           balance.swap_balance = asset(0, util::seeds_symbol);
                           balance.escrow_balance = asset(0, util::seeds_symbol);
                         });
    }
  }
}

ACTION escrow::withdraw(const name &account, const asset &quantity)
{
  require_auth(account);

  util::check_asset(quantity);

  balances_tables balances_t(get_self(), get_self().value);

  auto bitr = balances_t.find(account.value);
  check(bitr != balances_t.end(), "balance not found");
  check(bitr->available_balance >= quantity, "user does not have enough available balance");

  balances_t.modify(bitr, _self, [&](auto &balance)
                    { balance.available_balance -= quantity; });

  send_transfer(account, quantity, std::string("withdraw"));
}

ACTION escrow::upsertuser(
    const name &account,
    const mapss &contact_methods,
    const mapss &payment_methods,
    const name &time_zone,
    const name &fiat_currency)
{
  require_auth(account);

  util::check_seeds_user_status(account, util::seeds_visitor_status);

  user_tables users_t(get_self(), get_self().value);
  auto uitr = users_t.find(account.value);

  if (uitr != users_t.end())
  {
    users_t.modify(uitr, _self, [&](auto &item)
                   {
                     item.contact_methods = contact_methods;
                     item.payment_methods = payment_methods;
                     item.time_zone = time_zone;
                     item.fiat_currency = fiat_currency;
                   });
  }
  else
  {
    users_t.emplace(_self, [&](auto &item)
                    {
                      item.account = account;
                      item.contact_methods = contact_methods;
                      item.payment_methods = payment_methods;
                      item.time_zone = time_zone;
                      item.fiat_currency = fiat_currency;
                      item.is_arbiter = false;
                    });

    transactions_stats_tables trx_stats_t(get_self(), get_self().value);

    trx_stats_t.emplace(_self, [&](auto &trxstats)
                        {
                          trxstats.account = account;
                          trxstats.total_trx = 0;
                          trxstats.sell_successful = 0;
                          trxstats.buy_successful = 0;
                        });
  }
}

ACTION escrow::addpublickey(const name &account, const string &public_key)
{
  require_auth(account);

  user_public_key_tables public_t(get_self(), get_self().value);
  auto pitr = public_t.find(account.value);

  if (pitr == public_t.end())
  {
    public_t.emplace(_self, [&](auto &item)
                     {
                       item.account = account;
                       item.public_key = public_key;
                     });
  }
  else
  {
    public_t.modify(pitr, _self, [&](auto &item)
                    { item.public_key = public_key; });
  }
}

ACTION escrow::addselloffer(const name &seller, const asset &total_offered, const uint64_t &price_percentage)
{
  require_auth(seller);

  util::check_seeds_user_status(seller, util::seeds_resident_status);
  util::check_asset(total_offered);

  balances_tables balances_t(get_self(), get_self().value);

  auto bitr = balances_t.find(seller.value);
  check(bitr != balances_t.end(), "user does not have a balance entry");
  check(bitr->available_balance >= total_offered, "user does not have enough available balance to create the offer");

  balances_t.modify(bitr, _self, [&](auto &balance)
                    {
                      balance.available_balance -= total_offered;
                      balance.swap_balance += total_offered;
                    });

  user_tables users_t(get_self(), get_self().value);
  auto uitr = users_t.get(seller.value, "user not found");

  price_tables price(seeds::tlosto, seeds::tlosto.value);
  price_table p = price.get();

  asset current_price = p.current_seeds_per_usd;
  uint64_t seedsperusd = current_price.amount * price_percentage;
  offer_tables offers_t(get_self(), get_self().value);

  offers_t.emplace(_self, [&](auto &offer)
                   {
                     uint64_t new_id = offers_t.available_primary_key();
                     offer.id = new_id;
                     offer.sell_id = new_id;
                     offer.seller = seller;
                     offer.buyer = name("");
                     offer.type = offer_type_sell;
                     offer.quantity_info = {
                         {name("totaloffered"), total_offered},
                         {name("available"), total_offered},
                     };
                     offer.price_info = {
                         {name("priceper"), price_percentage},
                         {name("seedsperusd"), seedsperusd}};
                     offer.created_date = current_time_point();
                     offer.status_history.insert(std::make_pair(sell_offer_status_active, current_time_point()));
                     offer.current_status = sell_offer_status_active;
                     offer.payment_methods = uitr.payment_methods;
                     offer.time_zone = uitr.time_zone;
                     offer.fiat_currency = uitr.fiat_currency;
                   });
}

ACTION escrow::cancelsoffer(const uint64_t &sell_offer_id)
{
  offer_tables offers_t(get_self(), get_self().value);

  auto oitr = offers_t.find(sell_offer_id);
  check(oitr != offers_t.end(), "sell offer not found");
  check(oitr->type == offer_type_sell, "offer is not a sell offer");

  name seller = oitr->seller;

  require_auth(seller);

  balances_tables balances_t(get_self(), get_self().value);
  auto bitr = balances_t.find(seller.value);
  check(bitr != balances_t.end(), "user balance not found");

  auto quantity_info = oitr->quantity_info;
  auto available = quantity_info.find(name("available"));

  balances_t.modify(bitr, _self, [&](auto &balance)
                    {
                      balance.swap_balance -= available->second;
                      balance.available_balance += available->second;
                    });

  offers_t.modify(oitr, _self, [&](auto &offer)
                  {
                    offer.status_history.insert(std::make_pair(sell_offer_status_canceled, current_time_point()));
                    offer.current_status = sell_offer_status_canceled;
                    offer.quantity_info.at(name("available")) = asset(0, util::seeds_symbol);
                  });

  auto offersby_sell_id = offers_t.get_index<name("bysellid")>();

  auto obsitr = offersby_sell_id.lower_bound(uint128_t(sell_offer_id) << 64);
  while (obsitr != offersby_sell_id.end() && obsitr->sell_id == sell_offer_id)
  {
    if (obsitr->type == offer_type_buy)
    {
      rejctbuyoffr(obsitr->id);
    }
    obsitr++;
  }
}

ACTION escrow::addbuyoffer(const name &buyer, const uint64_t &sell_offer_id, const asset &quantity, const std::string &payment_method)
{
  require_auth(buyer);

  util::check_seeds_user_status(buyer, util::seeds_visitor_status);
  util::check_asset(quantity);

  user_tables users_t(get_self(), get_self().value);
  auto uitr = users_t.get(buyer.value, "user not found");

  offer_tables offers_t(get_self(), get_self().value);
  auto sitr = offers_t.get(sell_offer_id, "sell offer not found");

  check(sitr.type == offer_type_sell, "offer is not a sell offer");
  check(sitr.quantity_info[name("available")] >= quantity, "sell offer does not have enough funds");
  check(sitr.seller != buyer, "can not propose a buy offer for your own sell offer");

  auto allowed_payment_method = sitr.payment_methods.find(payment_method);
  check(allowed_payment_method != sitr.payment_methods.end(), "payment method is not allowed");

  uint64_t id = offers_t.available_primary_key();

  offers_t.emplace(_self, [&](auto &offer)
                   {
                     offer.id = id;
                     offer.sell_id = sell_offer_id;
                     offer.seller = sitr.seller;
                     offer.buyer = buyer;
                     offer.type = offer_type_buy;
                     offer.quantity_info.insert(std::make_pair(name("buyquantity"), quantity));
                     offer.price_info = sitr.price_info;
                     offer.created_date = current_time_point();
                     offer.status_history.insert(std::make_pair(buy_offer_status_pending, current_time_point()));
                     offer.payment_methods.insert(*allowed_payment_method);
                     offer.current_status = buy_offer_status_pending;
                     offer.time_zone = sitr.time_zone;
                     offer.fiat_currency = sitr.fiat_currency;
                   });

  buy_sell_relation_tables buysellrel_t(get_self(), get_self().value);

  buysellrel_t.emplace(_self, [&](auto &rel)
                       {
                         rel.id = buysellrel_t.available_primary_key();
                         rel.sell_offer_id = sell_offer_id;
                         rel.buy_offer_id = id;
                       });
}

ACTION escrow::delbuyoffer(const uint64_t &buy_offer_id)
{
  offer_tables offers_t(get_self(), get_self().value);

  auto bitr = offers_t.find(buy_offer_id);
  check(bitr != offers_t.end(), "buy offer not found");
  check(bitr->type == offer_type_buy, "offer is not a buy offer");
  check(bitr->current_status == buy_offer_status_pending, "can not delete offer, status is not pending");

  require_auth(bitr->buyer);

  uint64_t max_seller_time = config_get_uint64(name("b.accpt.lim"));
  uint64_t cutoff = current_time_point().sec_since_epoch() - max_seller_time;
  check(bitr->created_date.sec_since_epoch() < cutoff, "can not delete offer, it is too early");

  buy_sell_relation_tables buysellrel_t(get_self(), get_self().value);

  auto buysellrel_by_buy = buysellrel_t.get_index<name("bybuy")>();
  auto bsritr = buysellrel_by_buy.find(buy_offer_id);

  if (bsritr != buysellrel_by_buy.end())
  {
    buysellrel_by_buy.erase(bsritr);
  }

  offers_t.erase(bitr);
}

ACTION escrow::accptbuyoffr(const uint64_t &buy_offer_id)
{
  offer_tables offers_t(get_self(), get_self().value);

  auto boitr = offers_t.find(buy_offer_id);
  check(boitr != offers_t.end(), "buy offer not found");
  check(boitr->type == offer_type_buy, "offer is not a buy offer");
  check(boitr->current_status == buy_offer_status_pending, "can not accept this buy offer, it's status is not pending");

  name seller = boitr->seller;
  asset quantity = boitr->quantity_info.find(name("buyquantity"))->second;

  require_auth(seller);

  offers_t.modify(boitr, _self, [&](auto &buyoffer)
                  {
                    buyoffer.status_history.insert(std::make_pair(buy_offer_status_accepted, current_time_point()));
                    buyoffer.current_status = buy_offer_status_accepted;
                  });

  buy_sell_relation_tables buysellrel_t(get_self(), get_self().value);

  auto buysellrel_by_buy = buysellrel_t.get_index<name("bybuy")>();
  auto bsritr = buysellrel_by_buy.get(buy_offer_id, "buy offer id relation not found");

  auto sitr = offers_t.find(bsritr.sell_offer_id);
  check(sitr != offers_t.end(), "sell offer not found");

  asset available = sitr->quantity_info.find(name("available"))->second;
  check(available >= quantity, "sell offer does not have enough funds");

  offers_t.modify(sitr, _self, [&](auto &selloffer)
                  {
                    selloffer.quantity_info.at(name("available")) = available - quantity;
                    available = selloffer.quantity_info.at(name("available"));
                    if (available.amount == 0)
                    {
                      selloffer.current_status = sell_offer_status_soldout;
                      selloffer.status_history.insert(std::make_pair(sell_offer_status_soldout, current_time_point()));
                    }
                  });

  balances_tables balances_t(get_self(), get_self().value);

  auto bitr = balances_t.find(seller.value);
  check(bitr != balances_t.end(), "seller balance not found");

  balances_t.modify(bitr, _self, [&](auto &balance)
                    {
                      balance.swap_balance -= quantity;
                      balance.escrow_balance += quantity;
                    });
}

ACTION escrow::rejctbuyoffr(const uint64_t &buy_offer_id)
{

  offer_tables offers_t(get_self(), get_self().value);

  auto boitr = offers_t.find(buy_offer_id);
  check(boitr != offers_t.end(), "buy offer not found");
  check(boitr->type == offer_type_buy, "offer is not a buy offer");
  check(boitr->current_status == buy_offer_status_pending, "can not reject this buy offer, it's status is not pending");

  require_auth(boitr->seller);

  offers_t.modify(boitr, _self, [&](auto &buyoffer)
                  {
                    buyoffer.status_history.insert(std::make_pair(buy_offer_status_rejected, current_time_point()));
                    buyoffer.current_status = buy_offer_status_rejected;
                  });
}

ACTION escrow::payoffer(const uint64_t &buy_offer_id)
{
  offer_tables offers_t(get_self(), get_self().value);

  auto boitr = offers_t.find(buy_offer_id);
  check(boitr != offers_t.end(), "buy offer not found");
  check(boitr->type == offer_type_buy, "offer is not a buy offer");

  require_auth(boitr->buyer);

  check(boitr->current_status == buy_offer_status_accepted, "can not pay the offer, the offer is not accepted");

  offers_t.modify(boitr, _self, [&](auto &buyoffer)
                  {
                    buyoffer.status_history.insert(std::make_pair(buy_offer_status_paid, current_time_point()));
                    buyoffer.current_status = buy_offer_status_paid;
                  });
}

ACTION escrow::confrmpaymnt(const uint64_t &buy_offer_id)
{
  offer_tables offers_t(get_self(), get_self().value);

  auto boitr = offers_t.find(buy_offer_id);
  check(boitr != offers_t.end(), "buy offer not found");

  name seller = boitr->seller;
  name buyer = boitr->buyer;

  if (has_auth(seller))
    require_auth(seller);
  else
    require_auth(get_self());

  check(boitr->current_status == buy_offer_status_paid, "can not confirm payment, offer is not marked as paid");

  asset quantity = boitr->quantity_info.find(name("buyquantity"))->second;

  send_transfer(boitr->buyer, quantity, std::string("SEEDS bought from " + seller.to_string()));

  offers_t.modify(boitr, _self, [&](auto &buyoffer)
                  {
                    buyoffer.status_history.insert(std::make_pair(buy_offer_status_successful, current_time_point()));
                    buyoffer.current_status = buy_offer_status_successful;
                  });

  balances_tables balances_t(get_self(), get_self().value);

  auto bitr = balances_t.find(seller.value);

  balances_t.modify(bitr, _self, [&](auto &balance)
                    { balance.escrow_balance -= quantity; });

  check_sale_success(buy_offer_id);

  add_success_transaction(seller, offer_type_sell);
  add_success_transaction(buyer, offer_type_buy);
}

// ACTION escrow::initarbitrge() {}

void escrow::send_transfer(const name &beneficiary, const asset &quantity, const std::string &memo)
{
  action(
      permission_level(get_self(), "active"_n),
      seeds::token,
      "transfer"_n,
      std::make_tuple(get_self(), beneficiary, quantity, memo))
      .send();
}

void escrow::add_success_transaction(const name &account, const name &trx_type)
{
  transactions_stats_tables trx_stats_t(get_self(), get_self().value);

  auto titr = trx_stats_t.find(account.value);

  trx_stats_t.modify(titr, _self, [&](auto &trxstats)
                     {
                       trxstats.total_trx += 1;
                       if (trx_type == offer_type_sell)
                       {
                         trxstats.sell_successful += 1;
                       }
                       else
                       {
                         trxstats.buy_successful += 1;
                       }
                     });
}

void escrow::addarbiter(const name &account)
{
  require_auth(get_self());

  user_tables users_t(get_self(), get_self().value);
  auto uitr = users_t.find(account.value);
  check(uitr != users_t.end(), "user not found");
  check(uitr->is_arbiter == 0, "user is already arbiter");

  users_t.modify(uitr, _self, [&](auto &user)
                 { user.is_arbiter = true; });
}

void escrow::delarbiter(const name &account)
{
  require_auth(get_self());

  user_tables users_t(get_self(), get_self().value);
  auto uitr = users_t.find(account.value);
  check(uitr != users_t.end(), "user not found");
  check(uitr->is_arbiter == 1, "user is not arbiter");

  users_t.modify(uitr, _self, [&](auto &user)
                 { user.is_arbiter = false; });
}

void escrow::initarbitrage(const uint64_t &buy_offer_id)
{
  offer_tables offers_t(get_self(), get_self().value);

  auto boitr = offers_t.find(buy_offer_id);
  check(boitr != offers_t.end(), "buy offer not found");

  name seller = boitr->seller;
  name buyer = boitr->buyer;

  name auth = has_auth(seller) ? seller : buyer;
  require_auth(auth);

  auto paid_date = boitr->status_history.find(name("b.paid"))->second;
  uint64_t max_seller_time = config_get_uint64(name("b.confrm.lim"));
  uint64_t cutoff = current_time_point().sec_since_epoch() - max_seller_time;
  check(paid_date.sec_since_epoch() < cutoff, "can not create arbitrage, it is too early");

  arbitrage_tables arbitrage_offers_t(get_self(), get_self().value);

  auto aritr = arbitrage_offers_t.find(buy_offer_id);
  check(aritr == arbitrage_offers_t.end(), "arbitrage already exists");

  arbitrage_offers_t.emplace(_self, [&](auto &arbitrage)
                             {
                               arbitrage.offer_id = buy_offer_id;
                               arbitrage.arbiter = arbitrage_pending;
                               arbitrage.resolution = arbitrage_pending;
                               arbitrage.notes = "";
                               arbitrage.created_date = current_time_point();
                               arbitrage.buyer_contact.insert(std::make_pair(buyer, false));
                               arbitrage.seller_contact.insert(std::make_pair(seller, false));
                             });

  offers_t.modify(boitr, _self, [&](auto &buyoffer)
                  {
                    buyoffer.status_history.insert(std::make_pair(arbitrage_status_pending, current_time_point()));
                    buyoffer.current_status = arbitrage_status_pending;
                  });
}

void escrow::arbtrgeoffer(const name &arbiter, const uint64_t &offer_id)
{
  user_tables users_t(get_self(), get_self().value);

  auto uitr = users_t.find(arbiter.value);
  check(uitr != users_t.end(), "user not found");
  check(uitr->is_arbiter == 1, "user is not arbiter");

  require_auth(arbiter);

  arbitrage_tables arbitrage_offers_t(get_self(), get_self().value);

  auto aritr = arbitrage_offers_t.find(offer_id);
  check(aritr != arbitrage_offers_t.end(), "arbitrage does not exist");

  offer_tables offers_t(get_self(), get_self().value);

  auto boitr = offers_t.find(offer_id);
  check(boitr != offers_t.end(), "offer does not exist");

  arbitrage_offers_t.modify(aritr, _self, [&](auto &arbitrage)
                            {
                              arbitrage.resolution = arbitrage_status_inprogress;
                              arbitrage.arbiter = arbiter;
                            });

  offers_t.modify(boitr, _self, [&](auto &buyoffer)
                  {
                    buyoffer.status_history.insert(std::make_pair(arbitrage_status_inprogress, current_time_point()));
                    buyoffer.current_status = arbitrage_status_inprogress;
                  });
}

void escrow::resolvesellr(const uint64_t &offer_id, const string &notes)
{
  arbitrage_tables arbitrage_offers_t(get_self(), get_self().value);

  auto aritr = arbitrage_offers_t.find(offer_id);
  check(aritr != arbitrage_offers_t.end(), "arbitrage does not exist");
  check(aritr->resolution == arbitrage_status_inprogress, "this arbitration ticket isn't in progress");

  name arbiter = aritr->arbiter;
  require_auth(arbiter);

  offer_tables offers_t(get_self(), get_self().value);

  auto boitr = offers_t.find(offer_id);
  check(boitr != offers_t.end(), "buy offer not found");
  check(boitr->type == offer_type_buy, "offer is not a buy offer");
  check(boitr->current_status == arbitrage_status_inprogress, "offer is not under arbitration");

  asset quantity = boitr->quantity_info.find(name("buyquantity"))->second;
  name seller = boitr->seller;

  balances_tables balances_t(get_self(), get_self().value);

  auto bitr = balances_t.find(seller.value);
  check(bitr != balances_t.end(), "balance not found");

  buy_sell_relation_tables buysellrel_t(get_self(), get_self().value);

  auto buysellrel_by_buy = buysellrel_t.get_index<name("bybuy")>();
  auto bsritr = buysellrel_by_buy.get(offer_id, "buy offer id relation not found");

  auto sitr = offers_t.find(bsritr.sell_offer_id);
  check(sitr != offers_t.end(), "sell offer not found");

  asset available = sitr->quantity_info.find(name("available"))->second;
  asset totaloffered = sitr->quantity_info.find(name("totaloffered"))->second;

  offers_t.modify(sitr, _self, [&](auto &selloffer)
                  {
    selloffer.quantity_info.at(name("available")) = available + quantity; // Return offered to available });

    arbitrage_offers_t.modify(aritr, _self, [&](auto &arbitrage)
                              {
                                arbitrage.resolution = seller;
                                arbitrage.notes = notes;
                              });

    balances_t.modify(bitr, _self, [&](auto &balance)
                      {
                        balance.escrow_balance -= quantity;
                        balance.swap_balance += quantity;
                      });

    offers_t.modify(boitr, _self, [&](auto &buyoffer)
                    {
                      buyoffer.status_history.insert(std::make_pair(buy_offer_status_flagged, current_time_point()));
                      buyoffer.current_status = buy_offer_status_flagged;
                    });

    // Penalize buyer - pending
}

void escrow::resolvebuyer(const uint64_t &offer_id, const string &notes)
{
    arbitrage_tables arbitrage_offers_t(get_self(), get_self().value);

    auto aritr = arbitrage_offers_t.find(offer_id);
    check(aritr != arbitrage_offers_t.end(), "arbitrage does not exist");
    check(aritr->resolution == arbitrage_status_inprogress, "this arbitration ticket isn't in progress");

    name arbiter = aritr->arbiter;
    require_auth(arbiter);

    offer_tables offers_t(get_self(), get_self().value);

    auto boitr = offers_t.find(offer_id);
    check(boitr != offers_t.end(), "buy offer not found");
    check(boitr->type == offer_type_buy, "offer is not a buy offer");
    check(boitr->current_status == arbitrage_status_inprogress, "offer is not under arbitration");

    name buyer = boitr->buyer;
    name seller = boitr->seller;
    asset quantity = boitr->quantity_info.find(name("buyquantity"))->second;

    balances_tables balances_t(get_self(), get_self().value);

    auto sitr = balances_t.find(seller.value);
    check(sitr != balances_t.end(), "balance not found");

    send_transfer(boitr->buyer, quantity, std::string("SEEDS bought from " + seller.to_string()));

    arbitrage_offers_t.modify(aritr, _self, [&](auto &arbitrage)
                              {
                                arbitrage.resolution = buyer;
                                arbitrage.notes = notes;
                              });

    balances_t.modify(sitr, _self, [&](auto &balance)
                      { balance.escrow_balance -= quantity; });

    // TODO - Reduce available quantity of sell offer

    offers_t.modify(boitr, _self, [&](auto &buyoffer)
                    {
                      buyoffer.status_history.insert(std::make_pair(buy_offer_status_successful, current_time_point()));
                      buyoffer.current_status = buy_offer_status_successful;
                    });

    add_success_transaction(buyer, offer_type_buy);

    check_sale_success(offer_id);

    // Penalize seller - pending
}

ACTION escrow::addoffermsg(
    const uint64_t &buy_offer_id,
    const string &iv,
    const string &ephem_key,
    const string &message,
    const checksum256 &mac)
{
    offer_tables offers_t(get_self(), get_self().value);

    auto boitr = offers_t.require_find(buy_offer_id, "buy offer not found");
    check(boitr->type == offer_type_buy, "offer is not a buy offer");

    name seller = boitr->seller;
    name buyer = boitr->buyer;

    name sender = has_auth(boitr->seller) ? boitr->seller : boitr->buyer;
    name receiver = sender == boitr->seller ? boitr->buyer : boitr->seller;

    require_auth(sender);

    private_message_tables msg_t(get_self(), get_self().value);

    msg_t.emplace(_self, [&](auto &item)
                  {
                    item.id = msg_t.available_primary_key();
                    item.buy_offer_id = buy_offer_id;
                    item.sender = sender;
                    item.receiver = receiver;
                    item.iv = iv;
                    item.ephem_key = ephem_key;
                    item.message = message;
                    item.mac = mac;
                  });
}

ACTION escrow::delprivtemsg(const uint64_t &message_id)
{
    private_message_tables msg_t(get_self(), get_self().value);
    auto mitr = msg_t.require_find(message_id, "message not found");

    name auth = has_auth(mitr->sender) ? mitr->sender : mitr->receiver;
    require_auth(auth);

    msg_t.erase(mitr);
}

ACTION escrow::sendconmethd(
    const uint64_t &buy_offer_id,
    const string &iv,
    const string &ephem_key,
    const string &message,
    const checksum256 &mac)
{
    offer_tables offers_t(get_self(), get_self().value);

    auto boitr = offers_t.require_find(buy_offer_id, "buy offer not found");
    check(boitr->type == offer_type_buy, "offer is not a buy offer");

    name seller = boitr->seller;
    name buyer = boitr->buyer;

    name auth = has_auth(seller) ? seller : buyer;

    require_auth(auth);

    arbitrage_tables arbitrage_offers_t(get_self(), get_self().value);

    auto aritr = arbitrage_offers_t.require_find(buy_offer_id, "arbitrage does not exist");

    name arbiter = aritr->arbiter;

    check(arbiter != arbitrage_pending, "Offer has not arbiter yet");

    arbitrage_offers_t.modify(aritr, _self, [&](auto &arbitrage)
                              {
                                if (has_auth(seller))
                                {
                                  arbitrage.seller_contact.at(seller) = true;
                                }
                                else
                                {
                                  arbitrage.buyer_contact.at(buyer) = true;
                                }
                              });

    private_message_tables msg_t(get_self(), get_self().value);

    msg_t.emplace(_self, [&](auto &item)
                  {
                    item.id = msg_t.available_primary_key();
                    item.buy_offer_id = buy_offer_id;
                    item.sender = auth;
                    item.receiver = arbiter;
                    item.iv = iv;
                    item.ephem_key = ephem_key;
                    item.message = message;
                    item.mac = mac;
                  });
}

void escrow::check_sale_success(const uint64_t &buy_offer_id)
{
    offer_tables offers_t(get_self(), get_self().value);
    auto boitr = offers_t.require_find(buy_offer_id, "buy offer not found");

    uint64_t sell_id = boitr->sell_id;

    auto soitr = offers_t.find(sell_id);
    check(soitr != offers_t.end(), "sell offer not found");

    asset offered_quantity = soitr->quantity_info.find(name("totaloffered"))->second;

    auto offers_by_sell = offers_t.get_index<name("bysellid")>();
    auto boitr_sell = offers_by_sell.lower_bound(uint128_t(sell_id) << 64);

    asset total_sold = asset(0, util::seeds_symbol);
    while (boitr_sell != offers_by_sell.end())
    {

      if (boitr_sell->type == offer_type_buy)
      {
        if (boitr_sell->sell_id != sell_id)
        {
          break;
        }

        asset quantity = boitr_sell->quantity_info.find(name("buyquantity"))->second;
        if (boitr_sell->current_status == buy_offer_status_successful)
          total_sold += quantity;
      }
      boitr_sell++;
    }

    bool all_is_sold = total_sold.amount == offered_quantity.amount;

    if (soitr->current_status == sell_offer_status_soldout && all_is_sold)
    {
      offers_t.modify(soitr, _self, [&](auto &selloffer)
                      {
                        selloffer.status_history.insert(std::make_pair(sell_offer_status_successful, current_time_point()));
                        selloffer.current_status = sell_offer_status_successful;
                      });
    }
}