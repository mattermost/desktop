var os = require('os');
var release_split = os.release().split('.');

module.exports = {
  major: parseInt(release_split[0]),
  minor: parseInt(release_split[1]),
  isLowerThanOrEqualWindows8_1: function() {
    if (process.platform != 'win32') {
      return false;
    }
    // consider Windows 7 and later.
    return (this.major <= 6 && this.minor <= 3);
  }
};
