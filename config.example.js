var config = {
  "token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "update_type": "long-polling", // or "webhook"
  "webhook": "https://www.example.com/<token>",
  //"proxy": "http://127.0.0.1:8118",
  //"bot_name": "example_bot", // check bot name,
  "private": false,
  "group_url": "https://telegram.me/pokemon_game",
  "admin_id": "35197423",
  "gba": {
    "rom_file": "/path/to/game.gba",
    "savedata_file": "/path/to/game.sav"
  }
};

module.exports = config;
