# telegram-pokemon-bot

Telegram plays pokemon! (yet another TPP :)

## How to play

1. Follow [@pokemon_game_bot](https://telegram.me/pokemon_game_bot)
2. Join the telegram group: [https://telegram.me/pokemon_game](https://telegram.me/pokemon_game) or type `/join` and wait for admin approve.
3. Type command `/keyboard` to use custom keyboard.

## Installation

1. Copy `config.example.js` to `config.js`, and modify it with your own options.
2. `npm install`
3. `npm start`

### GBA.js:
* Cross Platform [GBA.js](https://github.com/tengattack/gbajs).

### VBA extensions (legacy):
* Windows
* [VisualBoyAdvance-SDL](https://sourceforge.net/projects/vba/)
* Node.js x64
* [Visual C++ Redistributable for Visual Studio 2015](https://www.microsoft.com/en-us/download/details.aspx?id=48145)
* vba.node extension for Node.js (under /extensions lib: [Node v6.2.1](https://nodejs.org/dist/v6.2.1/node-v6.2.1-x64.msi), or you can compile it by yourself)
* NOTE: Windows Server need keep an active desktop, please check [here](https://support.smartbear.com/viewarticle/72794/).

## TODO

* Use `node-gyp` for auto installation.
* Telegram Webhooks.
