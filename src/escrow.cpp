#include <escrow.hpp>

ACTION escrow::reset()
{
  require_auth(get_self());

  auto uitr = users.begin();
  while(uitr != users.end())
  {
    uitr = users.erase(uitr);
  }

  auto titr = trxstats.begin();
  while(titr != trxstats.end())
  {
    titr = trxstats.erase(titr);
  }

  auto bitr = balances.begin();
  while(bitr != balances.end())
  {
    bitr = balances.erase(bitr);
  }

  auto sitr = selloffers.begin();
  while(sitr != selloffers.end())
  {
    sitr = selloffers.erase(sitr);
  }

  auto boitr = buyoffers.begin();
  while(boitr != buyoffers.end())
  {
    boitr = buyoffers.erase(boitr);
  }

  auto bsritr = buysellrel.begin();
  while(bsritr != buysellrel.end())
  {
    bsritr = buysellrel.erase(bsritr);
  }
}

ACTION escrow::deposit(const name & from, const name & to, const asset & quantity, const string & memo)
{
  if(get_first_receiver() == seeds::token && to == get_self() && from != get_self())
  {
    check_user(from);

    util::check_seeds_user_status(from, util::seeds_resident_status);
    util::check_asset(quantity);

    auto bitr = balances.find(from.value);

    if(bitr != balances.end())
    {
      balances.modify(bitr, _self, [&](auto & balance){
        balance.available_balance += quantity;
      });
    }
    else
    {
      balances.emplace(_self, [&](auto & balance){
        balance.account = from;
        balance.available_balance = quantity;
        balance.swap_balance = asset(0, util::seeds_symbol);
        balance.escrow_balance = asset(0, util::seeds_symbol);
      });
    }
  }
}

ACTION escrow::withdraw(const name & account, const asset & quantity)
{
  require_auth(account);

  util::check_asset(quantity);

  auto bitr = balances.find(account.value);
  check(bitr != balances.end(), "balance not found");
  check(bitr->available_balance >= quantity, "user has not enough available balance");

  balances.modify(bitr, _self, [&](auto & balance){
    balance.available_balance -= quantity;
  });

  send_transfer(account, quantity, string("withdraw"));
}

ACTION escrow::upsertuser(
  const name & account,
  const mapss & contact_methods,
  const mapss & payment_methods,
  const name & time_zone,
  const name & fiat_currency
)
{
  require_auth(account);

  util::check_seeds_user_status(account, util::seeds_visitor_status);

  auto uitr = users.find(account.value);

  if (uitr != users.end())
  {
    users.modify(uitr, _self, [&](auto & item){
      item.contact_methods = contact_methods;
      item.payment_methods = payment_methods;
      item.time_zone = time_zone;
      item.fiat_currency = fiat_currency;
    });
  }
  else
  {
    users.emplace(_self, [&](auto & item){
      item.account = account;
      item.contact_methods = contact_methods;
      item.payment_methods = payment_methods;
      item.time_zone = time_zone;
      item.fiat_currency = fiat_currency;
    });
  }
}

ACTION escrow::addselloffer(const name & seller, const asset & total_offered, const uint64_t price_percentage)
{
  require_auth(seller);

  util::check_seeds_user_status(seller, util::seeds_resident_status);
  util::check_asset(total_offered);

  auto uitr = users.get(seller.value, "user not found");
  
  auto bitr = balances.find(seller.value);
  check(bitr != balances.end(), "user does not have a balance entry");
  check(bitr->available_balance >= total_offered, "user does not have enough balance to create the offer");

  balances.modify(bitr, _self, [&](auto & balance){
    balance.available_balance -= total_offered;
    balance.swap_balance += total_offered;
  });

  selloffers.emplace(_self, [&](auto & offer){
    offer.id = selloffers.available_primary_key();
    offer.seller = seller;
    offer.total_offered = total_offered;
    offer.available_quantity = total_offered;
    offer.price_percentage = price_percentage;
    offer.created_date = current_time_point();
    offer.time_zone = uitr.time_zone;
    offer.fiat_currency = uitr.fiat_currency;
  });
}

ACTION escrow::delselloffer(const uint64_t & sell_offer_id)
{
  auto oitr = selloffers.find(sell_offer_id);
  check(oitr != selloffers.end(), "sell offer not found");

  name seller = oitr->seller;

  require_auth(seller);

  auto bitr = balances.find(seller.value);
  check(bitr != balances.end(), "user balance not found");

  balances.modify(bitr, _self, [&](auto & balance){
    balance.swap_balance -= oitr->available_quantity;
    balance.available_balance += oitr->available_quantity;
  });

  selloffers.erase(oitr);
}

ACTION escrow::addbuyoffer(const name & buyer, const uint64_t & sell_offer_id, const asset & quantity)
{
  require_auth(buyer);

  util::check_seeds_user_status(buyer, util::seeds_visitor_status);
  util::check_asset(quantity);

  auto uitr = users.get(buyer.value, "user not found");
  auto sitr = selloffers.get(sell_offer_id, "sell offer not found");

  check(sitr.available_quantity >= quantity, "sell offer does not have enough funds");

  uint64_t id = buyoffers.available_primary_key();

  buyoffers.emplace(_self, [&](auto & buyoffer){
    buyoffer.id = id;
    buyoffer.buyer = buyer;
    buyoffer.seller = sitr.seller;
    buyoffer.quantity = quantity;
    buyoffer.price_percentage = sitr.price_percentage;
    buyoffer.created_date = current_time_point();
    buyoffer.status_history.insert(std::make_pair(buy_offer_status_pending, current_time_point()));
    buyoffer.status = buy_offer_status_pending;
  });

  buysellrel.emplace(_self, [&](auto & rel){
    rel.id = buysellrel.available_primary_key();
    rel.sell_offer_id = sell_offer_id;
    rel.buy_offer_id = id;
  });
}

ACTION escrow::delbuyoffer(const uint64_t & buy_offer_id)
{
  auto bitr = buyoffers.find(buy_offer_id);
  
  check(bitr != buyoffers.end(), "buy offer not found");
  check(bitr->status == buy_offer_status_pending, "can not delete offer, status is not pending");

  require_auth(bitr->buyer);

  auto buysellrel_by_buy = buysellrel.get_index<name("bybuy")>();
  auto bsritr = buysellrel_by_buy.find(buy_offer_id);

  if(bsritr != buysellrel_by_buy.end())
  {
    buysellrel_by_buy.erase(bsritr);
  }

  buyoffers.erase(bitr);
}

ACTION escrow::accptbuyoffr(const uint64_t & buy_offer_id)
{
  auto boitr = buyoffers.find(buy_offer_id);
  check(boitr != buyoffers.end(), "buy offer not found");

  name seller = boitr->seller;
  asset quantity = boitr->quantity;

  require_auth(seller);

  // TODO: check the time outs

  buyoffers.modify(boitr, _self, [&](auto & buyoffer){
    buyoffer.status_history.insert(std::make_pair(buy_offer_status_accepted, current_time_point()));
    buyoffer.status = buy_offer_status_accepted;
  });

  auto buysellrel_by_buy = buysellrel.get_index<name("bybuy")>();
  auto bsritr = buysellrel_by_buy.get(buy_offer_id, "buy offer if relation not found");

  auto sitr = selloffers.find(bsritr.sell_offer_id);
  check(sitr != selloffers.end(), "sell offer not found");

  check(sitr->available_quantity >= quantity, "sell offer does not have enough funds");

  selloffers.modify(sitr, _self, [&](auto & selloffer){
    selloffer.available_quantity -= quantity;
  });

  auto bitr = balances.find(seller.value);
  check(bitr != balances.end(), "seller balance not found");

  balances.modify(bitr, _self, [&](auto & balance){
    balance.swap_balance -= quantity;
    balance.escrow_balance += quantity;
  });
}

void escrow::send_transfer(const name & beneficiary, const asset & quantity, const string & memo)
{
  action(
    permission_level(get_self(), "active"_n),
    seeds::token,
    "transfer"_n,
    std::make_tuple(get_self(), beneficiary, quantity, memo)
  ).send();
}
