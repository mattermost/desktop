var os = require('os');
var release_split = os.release().split('.');

module.exports = {
  major: parseInt(release_split[0]),
  minor: parseInt(release_split[1])
};
