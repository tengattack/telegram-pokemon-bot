'use strict'

const EventEmitter = require('events');
const fs = require('fs');
const request = require('request');
const _ = require('underscore');

const TG_BOT_URL = 'https://api.telegram.org/bot';
const DEF_LONG_POLLING_TIMEOUT = 30; // 30s

class BotApiCommands extends EventEmitter {};

function BotApi(token, opts) {
  this.commands = new BotApiCommands();
  this.events = new EventEmitter();
  this.token_url = TG_BOT_URL + token;
  this.opts = opts ? opts : {};
  this.check_fn = null;
}

BotApi.prototype.urlMethod = function (method) {
  return (this.token_url + '/' + method);
};

BotApi.prototype.start = function () {
  this.polling();
};

BotApi.prototype.setCheck = function (fn) {
  this.check_fn = fn;
};

// process single update
BotApi.prototype.process = function (upd) {
  var text = null;
  if (upd.message) {
    var enti = upd.message.entities;
    if (enti && typeof(enti[0]) === 'object' && enti[0].type === 'bot_command') {
      //var chat_id = msg.chat.id;
      text = upd.message.text;
    }
  } else if (upd.callback_query) {
    text = upd.callback_query.data;
  }

  if (text) {
    var m = text.match(/^\/([^\s]+)(\s+([\S\s]*))?/);

    if (m && m[1]) {
      var cmds = m[1].split('@');
      if (cmds.length > 1 && this.opts.botName) {
        // check bot name
        if (cmds[1] !== this.opts.botName) {
          return;
        }
      }
      if (this.check_fn) {
        if (this.check_fn(cmds[0], upd)) {
          // pass
          return;
        }
      }
      this.commands.emit(cmds[0], upd, m[3]);
    }
  }
};

// long polling function
BotApi.prototype.polling = function () {
  var self = this;
  this.getUpdates((err, updates) => {
    if (err && err.code === 'ETIMEDOUT') {
      // long polling time out.
      self.polling();
      return;
    }
    if (err) {
      console.error(err);
    } else {
      this.events.emit('begin', updates.length);

      // it should be an array
      updates.forEach(function (upd) {
        if (upd.update_id) {
          // Identifier of the first update to be returned.
          // Must be greater by one than the highest among the identifiers
          //   of previously received updates.
          self.update_id = upd.update_id + 1;
        }
        self.process(upd);
        self.lastupd = upd;
      });

      this.events.emit('end', updates.length);
    }
    // go on polling
    self.polling();
  });
};

BotApi.prototype.post = function (method, formdata, opts, cb) {
  var _opts = {
    method: 'POST',
    url: this.urlMethod(method),
    gzip: true,
    json: true
  };
  if (!opts.formData) {
    _opts.form = formdata;
  }
  if (this.opts.proxyUrl) {
    _opts.proxy = this.opts.proxyUrl;
    //_opts.tunnel = false;
  }
  if (typeof(opts) === 'function') {
    cb = opts;
    opts = {};
  }
  opts = _.extend(_opts, opts);

  request(opts, (err, resp, body) => {
    if (err) {
      cb(err);
    } else if (typeof(body) === 'object') {
      if (body.ok) {
        //if (typeof(body.result) === 'object') {
          cb(null, body.result);
        /*} else {
          cb('unformatted result');
        }*/
      } else {
        cb(body);
      }
    } else {
      cb(body ? body : 'unknown error');
    }
 });
};

BotApi.prototype.getUpdates = function (cb) {
  var formdata = {
    timeout: DEF_LONG_POLLING_TIMEOUT,
  };
  if (this.update_id) {
    formdata.offset = this.update_id;
  }

  this.post('getUpdates', formdata, {
    timeout: DEF_LONG_POLLING_TIMEOUT * 1000,
  }, cb);
};

BotApi.prototype.sendMessage = function (params, cb) {
  this.post('sendMessage', params, cb ? cb : () => {});
};

BotApi.prototype.sendPhoto = function (params, cb) {
  this.post('sendPhoto', null, { formData: params }, cb ? cb : () => {});
};

BotApi.prototype.sendDocument = function (params, cb) {
  this.post('sendDocument', null, { formData: params }, cb ? cb : () => {});
};

BotApi.prototype.answerCallbackQuery = function (params, cb) {
  this.post('answerCallbackQuery', params, cb ? cb : () => {});
};

BotApi.prototype.editMessageReplyMarkup = function (params, cb) {
  this.post('editMessageReplyMarkup', params, cb ? cb : () => {});
};

BotApi.prototype.getChat = function (params, cb) {
  this.post('getChat', params, cb ? cb :() => {});
};

BotApi.prototype.getChatAdministrators = function (params, cb) {
  this.post('getChatAdministrators', params, cb ? cb :() => {});
};

BotApi.prototype.getFile = function (params, cb) {
  this.post('getFile', params, cb ? cb :() => {});
};

BotApi.prototype.downloadFile = function (file_path, download_path, cb) {
  var download_url = this.token_url.replace('/bot', '/file/bot') + '/' + file_path;
  var _opts = {
    method: 'GET',
    url: download_url,
  };
  if (this.opts.proxyUrl) {
    _opts.proxy = this.opts.proxyUrl;
    //_opts.tunnel = false;
  }
  let r = request(_opts);
  // verify response code
  r.on('response', function (resp) {
    if (resp.statusCode !== 200) {
      return cb(new Error('Response status was ' + resp.statusCode));
    }
    let p = fs.createWriteStream(download_path);
    r.pipe(p);
    p.on('finish', function () {
      p.close(cb);  // close() is async, call cb after close completes.
    });
  });
  r.on('error', function (err) {
    cb(err);
  });
}

module.exports = BotApi;
