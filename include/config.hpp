#include <eosio/eosio.hpp>
#include <variant>
#include <util.hpp>

using eosio::name;
using std::string;

typedef std::variant<std::monostate, uint64_t, int64_t, double, name, asset, string> SettingsValues;

#define DEFINE_CONFIG_TABLE TABLE config_table { \
      name key; \
      SettingsValues value; \
      string description; \
\
      uint64_t primary_key () const { return key.value; } \
\
      EOSLIB_SERIALIZE(config_table, (key)(value)(description)) \
    }; \
\
    typedef eosio::multi_index<"config"_n, config_table> config_tables;


#define DEFINE_CONFIG_GET \
      uint64_t config_get_uint64 (name key) { \
            auto citr = config.find(key.value);\
            if (citr == config.end()) { \
                  eosio::check(false, ("settings: the "+key.to_string()+" parameter has not been initialized").c_str());\
            }\
            return std::get<uint64_t>(citr->value);\
      } \
      int64_t config_get_int64 (name key) { \
            auto citr = config.find(key.value);\
            if (citr == config.end()) { \
                  eosio::check(false, ("settings: the "+key.to_string()+" parameter has not been initialized").c_str());\
            }\
            return std::get<int64_t>(citr->value);\
      } \
      double config_get_double (name key) { \
            auto citr = config.find(key.value);\
            if (citr == config.end()) { \
                  eosio::check(false, ("settings: the "+key.to_string()+" parameter has not been initialized").c_str());\
            }\
            return std::get<double>(citr->value);\
      } \
      name config_get_name (name key) { \
            auto citr = config.find(key.value);\
            if (citr == config.end()) { \
                  eosio::check(false, ("settings: the "+key.to_string()+" parameter has not been initialized").c_str());\
            }\
            return std::get<name>(citr->value);\
      } \
      asset config_get_asset (name key) { \
            auto citr = config.find(key.value);\
            if (citr == config.end()) { \
                  eosio::check(false, ("settings: the "+key.to_string()+" parameter has not been initialized").c_str());\
            }\
            return std::get<asset>(citr->value);\
      } \
      string config_get_string (name key) { \
            auto citr = config.find(key.value);\
            if (citr == config.end()) { \
                  eosio::check(false, ("settings: the "+key.to_string()+" parameter has not been initialized").c_str());\
            }\
            return std::get<string>(citr->value);\
      }
