'use strict'

const fs = require('fs');
const path = require('path');
const request = require('request');
const _ = require('underscore');
const validator = require('validator');
const concat = require('concat-stream');
const CRC32 = require('crc-32');
const GameBoyAdvance = require('gbajs');

const config = require('./config');
const BotApi = require('./lib/botapi');

if (!config.gba) {
  console.error('Please specify gba rom & savedata file in config.');
  process.exit(1);
}

var gba = new GameBoyAdvance();
var keypad;
var biosBuf = fs.readFileSync('./node_modules/gbajs/resources/bios.bin');

var getSavedataHash = function () {
  var sram = gba.mmu.save;
  if (sram) {
    var buf = Buffer.from(sram.buffer);
    return CRC32.buf(buf);
  }
};

var activeGame = function () {
  // run once
  var activeTimer = null;
  var hash = getSavedataHash();
  gba.runStable();

  // overrides current function
  activeGame = function () {
    if (gba.paused) {
      gba.runStable();
    }
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    activeTimer = setTimeout(function () {
      if (gba.paused) {
        return;
      }
      gba.pause();
      var currentHash = getSavedataHash();
      if (hash !== currentHash) {
        hash = currentHash;
        gba.downloadSavedataToFile(config.gba.savedata_file);
      }
    }, 30000);
  };
  activeGame();
};

var ba = new BotApi(config.token, {
  proxyUrl: config.proxy,
  botName: config.bot_name,
});

var ss_flag = 0;
var ss_chat_id = null;
var ss_timeout = null;

var f_keyboard = [ [ '/l', '/up', '/r', '/a' ],
  [ '/left', '/down', '/right', '/b' ],
  [ '/st', '/sel', '/current', '/keyboard off' ] ];

var whiltlist_ids = [];

function readWhitelistIds() {
  if (config.admin_id) {
    whiltlist_ids.push(config.admin_id);
  }
  fs.readFile('./whitelist.json', 'utf8', (err, data) => {
    if (err) {
      console.log(err);
    } else {
      console.log('Whitelist: ' + data);
      try {
        var wl = JSON.parse(data);
        if (wl instanceof Array) {
          whiltlist_ids = _.union(wl, whiltlist_ids);
        }
      } catch (e) {}
      whiltlist_ids = _.uniq(whiltlist_ids);
    }
  });
}

function addWhitelistId(allow_id) {
  if (whiltlist_ids.indexOf(allow_id) >= 0) {
    // exists
    return false;
  }
  whiltlist_ids.push(allow_id);
  // save to file
  fs.writeFile('./whitelist.json', JSON.stringify(whiltlist_ids), (err) => {
    if (err) console.log(err);
  });
  return true;
}

function isWhitelistId(allow_id) {
  return (whiltlist_ids.indexOf(allow_id) >= 0);
}

readWhitelistIds();

function sendScreenShot() {
  var png = gba.screenshot();
  png.pack().pipe(concat(function (buf) {
    ba.sendPhoto({
      chat_id: ss_chat_id,
      photo: {
        value: buf,
        options: {
          filename: 'screenshot.png',
          contentType: 'image/png'
        },
      },
    }, (err, result) => {
      if (err) {
        console.log(err);
      }
      // console.log(err, result);
    });
  }));
}

/* setup bot */
ba.setCheck((cmd, upd) => {
  if (cmd === 'uploadsave' || cmd === 'downloadsave') {
    return false;
  }
  if (cmd !== 'current' && cmd !== 'join' && cmd !== 'keyboard') {
    if (!upd.message) {
      return false;
    }
    // check group chat and chat id
    let chat = upd.message.chat;
    if (whiltlist_ids.indexOf(chat.id) < 0) {
      ba.sendMessage({
        chat_id: chat.id,
        reply_markup: JSON.stringify({
          keyboard: [ [ '/current', '/join', '/keyboard off' ] ],
          selective: true
        }),
        reply_to_message_id: upd.message.message_id,
        text: 'Please join group: ' + config.group_url + ' or ask for /join',
      }, (err, result) => {
        if (err) {
          console.log(err);
        }
      });
      return true;
    }
  }
  return false;
});

ba.commands.on('flee', (upd, followString) => {
  let chat_id = upd.message.chat.id;
  ba.sendMessage({
    chat_id: chat_id,
    reply_markup: JSON.stringify({
      keyboard: f_keyboard
    }),
    text: 'ykyky'
  }, (err, result) => {
    if (err) {
      console.log(err);
    }
  });
});

ba.commands.on('ignore', (upd, followString) => {
  let cq = upd.callback_query;
  if (cq.message) {
    ba.editMessageReplyMarkup({
      chat_id: cq.message.chat.id,
      message_id: cq.message.message_id,
    });
  }
});
ba.commands.on('agree', (upd, followString) => {
  let cq = upd.callback_query;
  if (cq.message) {
    var allow_id = parseInt(followString);
    /*ba.answerCallbackQuery({
      callback_query_id: cq.id,
      text: 'allowed'*/
    ba.editMessageReplyMarkup({
      chat_id: cq.message.chat.id,
      message_id: cq.message.message_id,
    }, (err, result) => {
      if (err) {
        console.log(err);
      } else if (addWhitelistId(allow_id)) {
        ba.sendMessage({
          chat_id: allow_id,
          text: 'Congratulations! You have been approved.',
          reply_markup: JSON.stringify({
            keyboard: f_keyboard
          }),
        }, (err, result) => {
          if (err) {
            console.log(err);
          }
        });
        var msg = 'approved ' + allow_id;
        if (cq.from) {
          if (cq.from.first_name) {
            msg = cq.from.first_name + (cq.from.last_name ? ' ' + cq.from.last_name : '')
                + ' ' + msg;
          }
        }
        ba.sendMessage({
          chat_id: config.admin_id,
          text: msg
        });
      }
    });
  }
});
ba.commands.on('join', (upd, followString) => {
  let chat = upd.message.chat;
  if (isWhitelistId(chat.id)) {
    ba.sendMessage({
      chat_id: chat.id,
      text: 'keyboard on',
      reply_to_message_id: upd.message.message_id,
      reply_markup: JSON.stringify({
        keyboard: f_keyboard,
        selective: true
      }),
    }, (err, result) => {
      if (err) {
        console.log(err);
      }
    });
    return;
  }
  if (config.private) {
    ba.sendMessage({
      chat_id: chat.id,
      text: 'Bot is running at private mode. Please join group: ' + config.group_url,
    });
    return;
  }
  if (config.admin_id) {
    var msg = '';
    if (chat.type == 'private') {
      msg += 'User ' + chat.first_name + (chat.last_name ? ' ' + chat.last_name : '');
    } else if (chat.type == 'group' || chat.type == 'supergroup') {
      msg += 'Group ' + chat.title;
    }
    msg += ' ask for joining, do you agree?';

    ba.sendMessage({
      chat_id: config.admin_id,
      text: msg,
      reply_markup: JSON.stringify({
        inline_keyboard: [ [ { text: 'Agree', callback_data: '/agree ' + chat.id },
          { text: 'Ignore', callback_data: '/ignore ' + chat.id }] ]
      }),
    }, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        ba.sendMessage({
          chat_id: chat.id,
          text: 'Request sent, please waiting for result.'
        });
      }
    });
  }
});
ba.commands.on('last', (upd, followString) => {
  let chat_id = upd.message.chat.id;
  ba.sendMessage({
    chat_id: chat_id,
    text: JSON.stringify(ba.lastupd)
  }, (err, result) => {
    if (err) {
      console.log(err);
    }
  });
});

// define key command
function keypress(key, followString) {
  activeGame();
  if (followString && validator.isNumeric(followString)) {
    var time = parseInt(followString);
    if (time > keypad.PRESS_TIME * 60) {
      time = keypad.PRESS_TIME * 60;
    } else if (time <= 0) {
      time = 1;
    }
    keypad.press(key, time);
  } else {
    keypad.press(key);
  }
}
ba.commands.on('a', (upd, followString) => {
  keypress(keypad.A, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('b', (upd, followString) => {
  keypress(keypad.B, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('l', (upd, followString) => {
  keypress(keypad.L, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('r', (upd, followString) => {
  keypress(keypad.R, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('up', (upd, followString) => {
  keypress(keypad.UP, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('down', (upd, followString) => {
  keypress(keypad.DOWN, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('left', (upd, followString) => {
  keypress(keypad.LEFT, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('right', (upd, followString) => {
  keypress(keypad.RIGHT, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('st', (upd, followString) => {
  keypress(keypad.START, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('sel', (upd, followString) => {
  keypress(keypad.SELECT, followString);
  ss_chat_id = upd.message.chat.id;
  ss_flag++;
});
ba.commands.on('current', (upd, followString) => {
  ss_chat_id = upd.message.chat.id;
  ss_flag += 100;
});

ba.commands.on('keyboard', (upd, followString) => {
  let chat_id = upd.message.chat.id;
  if (followString === 'off') {
    ba.sendMessage({
      chat_id: chat_id,
      text: 'keyboard off',
      reply_to_message_id: upd.message.message_id,
      reply_markup: JSON.stringify({
        hide_keyboard: true,
        selective: true
      }),
    }, (err, result) => {
      if (err) {
        console.log(err);
      }
    });
  } else {
    ba.sendMessage({
      chat_id: chat_id,
      text: 'keyboard on',
      reply_to_message_id: upd.message.message_id,
      reply_markup: JSON.stringify({
        keyboard: f_keyboard,
        selective: true
      }),
    }, (err, result) => {
      if (err) {
        console.log(err);
      }
    });
  }
});

ba.events.on('begin', () => {
  ss_flag = 0;
});

function endEvent() {
  if (ss_flag > 0) {
    if (ss_timeout) {
      clearTimeout(ss_timeout);
      ss_timeout = 0;
    }
    if (ss_flag >= 100) {
      sendScreenShot();
    } else {
      ss_timeout = setTimeout(function () {
        sendScreenShot();
      }, 2000);
    }
  }
  ss_flag = 0;
}

ba.events.on('end', endEvent);

var started = false;

function start() {
  if (!started) {
    /* setup gba */
    gba.logLevel = gba.LOG_ERROR;
    gba.setBios(biosBuf);
    gba.setCanvasMemory();
  }
  gba.loadRomFromFile(config.gba.rom_file, function (err, result) {
    if (err) {
      console.error('loadRom failed:', err);
      process.exit(1);
    }
    gba.loadSavedataFromFile(config.gba.savedata_file, function (err) {
      if (err) {
        console.error('loadSavedata failed:', err);
        // process.exit(1);
      }
      activeGame();
      keypad = gba.keypad;
      if (!started) {
        ba.start();
        started = true;
      }
    });
  });
}

ba.commands.on('reset', (upd, followString) => {
  let chat = upd.message.chat;
  if (config.admin_id !== chat.id) {
    ba.sendMessage({
      chat_id: chat.id,
      text: 'You have no permission to do that.'
    });
    return;
  }
  if (chat.type !== 'private') {
    ba.getChatAdministrators({ chat_id: chat.id }, (err, adms) => {
      if (err) {
        console.log(err);
        return;
      }

      let isAdmin = false;
      for (var i = 0; i < adms.length; i++) {
        if (upd.message.from.id === adms[i].user.id) {
          isAdmin = true;
          break;
        }
      }
      if (!isAdmin) {
        ba.sendMessage({
          chat_id: chat.id,
          reply_to_message_id: upd.message.message_id,
          text: 'You have no permission to do that.'
        });
        return;
      }

      // reset the game
      gba.pause();
      gba.reset();
      start();
      ss_flag = 1;
      endEvent();
    });
    return;
  }
  // reset the game
  gba.pause();
  gba.reset();
  start();
  ss_flag = 1;
});

function downloadsave(chat_id) {
  fs.readFile(config.gba.savedata_file, function (err, buf) {
    if (err) {
      console.log(err);
      return;
    }
    var filename = path.basename(config.gba.savedata_file);
    ba.sendDocument({
      chat_id: chat_id,
      document: {
        value: buf,
        options: {
          filename: filename,
          contentType: 'application/octet-stream'
        },
      },
    }, (err, result) => {
      if (err) {
        console.log(err);
      }
      // console.log(err, result);
    });
  });
}

ba.commands.on('downloadsave', (upd, followString) => {
  ba.getChat({ chat_id: config.admin_id }, (err, chat) => {
    if (err) {
      console.log(err);
      return;
    }
    if (chat.type !== 'private') {
      ba.getChatAdministrators({ chat_id: chat.id }, (err, adms) => {
        if (err) {
          console.log(err);
          return;
        }

        let isAdmin = false;
        for (var i = 0; i < adms.length; i++) {
          if (upd.message.from.id === adms[i].user.id) {
            isAdmin = true;
            break;
          }
        }
        if (!isAdmin) {
          ba.sendMessage({
            chat_id: upd.message.chat.id,
            reply_to_message_id: upd.message.message_id,
            text: 'You have no permission to do that.'
          });
          return;
        }

        if (upd.message.chat.type !== 'private') {
          ba.sendMessage({
            chat_id: upd.message.chat.id,
            reply_to_message_id: upd.message.message_id,
            text: 'You shoud download save data in private.'
          });
          return;
        }

        // send to private chat
        downloadsave(upd.message.from.id);
      });
      return;
    } else {
      if (upd.message.chat.id !== config.admin_id) {
        ba.sendMessage({
          chat_id: upd.message.chat.id,
          text: 'You have no permission to do that.'
        });
        return;
      }

      downloadsave(chat.id);
    }
  });
});

function uploadsave(upd) {
  if (upd.message.reply_to_message && upd.message.reply_to_message.document) {
    let doc = upd.message.reply_to_message.document;
    // check file size limit
    if (doc.file_size > 2 * 1024 * 1024) {
      ba.sendMessage({
        chat_id: upd.message.chat.id,
        text: 'File size too large.'
      });
      return;
    }
    ba.getFile({ file_id: doc.file_id }, (err, file) => {
      if (err) {
        console.log(err);
        return;
      }
      ba.downloadFile(file.file_path, config.gba.savedata_file, function (err) {
        if (err) {
          console.log('download save data file error:', err)
          return;
        }
        ba.sendMessage({
          chat_id: upd.message.chat.id,
          text: 'Done. You can reset the game by /reset'
        });
      });
    });
    return;
  }
  ba.sendMessage({
    chat_id: upd.message.chat.id,
    text: 'You should reply a save data file with /uploadsave'
  });
}

ba.commands.on('uploadsave', (upd, followString) => {
  ba.getChat({ chat_id: config.admin_id }, (err, chat) => {
    if (err) {
      console.log(err);
      return;
    }
    if (chat.type !== 'private') {
      ba.getChatAdministrators({ chat_id: chat.id }, (err, adms) => {
        if (err) {
          console.log(err);
          return;
        }

        let isAdmin = false;
        for (var i = 0; i < adms.length; i++) {
          if (upd.message.from.id === adms[i].user.id) {
            isAdmin = true;
            break;
          }
        }
        if (!isAdmin) {
          ba.sendMessage({
            chat_id: upd.message.chat.id,
            reply_to_message_id: upd.message.message_id,
            text: 'You have no permission to do that.'
          });
          return;
        }

        if (upd.message.chat.type !== 'private') {
          ba.sendMessage({
            chat_id: upd.message.chat.id,
            reply_to_message_id: upd.message.message_id,
            text: 'You shoud upload save data in private.'
          });
          return;
        }

        uploadsave(upd);
      });
      return;
    } else {
      if (upd.message.chat.id !== config.admin_id) {
        ba.sendMessage({
          chat_id: upd.message.chat.id,
          text: 'You have no permission to do that.'
        });
        return;
      }

      uploadsave(upd);
    }
  });
});

start();
