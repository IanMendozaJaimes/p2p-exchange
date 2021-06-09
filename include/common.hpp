#include <eosio/eosio.hpp>
#include <util.hpp>

using eosio::name;

typedef std::map<std::string, std::string> mapss;
typedef std::map<name, time_point> mapnt;
typedef std::map<name, uint64_t> mapnui64;
typedef std::map<name, asset> mapna;
typedef std::map<name, std::variant<asset, uint64_t>> mapasui64;

typedef std::vector<std::string> vs;

