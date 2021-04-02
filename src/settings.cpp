#include <settings.hpp>

ACTION settings::reset()
{
  auto citr = config.begin();
  while (citr != config.end())
  {
    citr = config.erase(citr);
  }
}

ACTION settings::setparam(name key, SettingsValues value, string description)
{
  auto citr = config.find(key.value);
  if (citr == config.end())
  {
    config.emplace(_self, [&](auto & item){
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
    config.modify(citr, _self, [&](auto & item){
      item.value = value;
      if (description.length() > 0)
      {
        item.description = description;
      }
    });
  }
}

