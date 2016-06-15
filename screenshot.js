'use strict'

const VBAEmulator = require('./extensions/vba').VBAEmulator;
const fs = require('fs');

var vba = new VBAEmulator();

vba.screenshot(function (err, buf) {
  if (err) {
    return;
  }
  fs.writeFile('./screenshot.png', buf, () => {});
});
