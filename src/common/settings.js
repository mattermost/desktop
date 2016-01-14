'use strict';

const fs = require('fs');
const version = 1;

var upgradeV0toV1 = function(config_v0) {
  return {
    teams: [{
      name: 'Primary team',
      url: config_v0.url
    }],
    hideMenuBar: false,
    version: 1
  };
};

var upgrade = function(config) {
  var config_version = config.version ? config.version : 0;
  switch (config_version) {
    case 0:
      return upgrade(upgradeV0toV1(config));
    default:
      return config;
  }
};

module.exports = {
  version: version,

  upgrade: upgrade,

  readFileSync: function(configFile) {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  },

  writeFileSync: function(configFile, config) {
    if (config.version != version) {
      throw 'version ' + config.version + ' is not equal to ' + version;
    }
    var data = JSON.stringify(config, null, '  ');
    fs.writeFileSync(configFile, data, 'utf8');
  },

  loadDefault: function() {
    return {
      teams: [],
      hideMenuBar: false,
      version: version
    };
  }
};
