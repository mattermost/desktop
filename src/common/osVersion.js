'use strict';

var os = require('os');
var releaseSplit = os.release().split('.');

module.exports = {
  major: parseInt(releaseSplit[0], 10),
  minor: parseInt(releaseSplit[1], 10),
  isLowerThanOrEqualWindows8_1() {
    if (process.platform !== 'win32') {
      return false;
    }

    // consider Windows 7 and later.
    return (this.major <= 6 && this.minor <= 3);
  },
};
