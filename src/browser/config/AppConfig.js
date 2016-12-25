const settings = require('../../common/settings');
const {remote} = require('electron');

var config;
try {
  const configFile = remote.app.getPath('userData') + '/config.json';
  config = settings.readFileSync(configFile);
} catch (e) {
  config = {};
}

module.exports = config;
