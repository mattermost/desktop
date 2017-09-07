'use strict';

const fs = require('fs');

const path = require('path');
let deepmerge = require('deepmerge').default;
if (process.env.TEST) {
  deepmerge = require('deepmerge'); // eslint-disable-line
}

const settingsVersion = 1;
const baseConfig = require('./config/base.json');
const overrideConfig = require('./config/override.json');

function merge(base, target) {
  return Object.assign({}, base, target);
}

function deepMergeArray(source, dest) {
  return dest;
}

function loadDefault(version, spellCheckerLocale) {
  var ver = version;
  if (version == null) {
    ver = settingsVersion;
  }

  const base = baseConfig[ver] || baseConfig.default;
  const override = overrideConfig[ver] || {};

  const defaults = deepmerge(base, override, {arrayMerge: deepMergeArray});

  return Object.assign(defaults, {
    spellCheckerLocale: spellCheckerLocale || defaults.spellCheckerLocale || 'en-US'
  });
}

function upgradeV0toV1(configV0) {
  var config = loadDefault(1);
  config.teams.push({
    name: 'Primary team',
    url: configV0.url
  });
  return config;
}

function upgrade(config, newAppVersion) {
  var configVersion = config.version ? config.version : 0;
  if (newAppVersion) {
    config.lastMattermostVersion = newAppVersion;
  }
  switch (configVersion) {
  case 0:
    return upgrade(upgradeV0toV1(config));
  default:
    return config;
  }
}

module.exports = {
  version: settingsVersion,

  upgrade,

  readFileSync(configFile) {
    var config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

    // need to be able to compare 1 to '1'
    if (config.version == settingsVersion) { // eslint-disable-line
      var defaultConfig = this.loadDefault();
      config = merge(defaultConfig, config);
    }

    return config;
  },

  writeFile(configFile, config, callback) {
    // need to be able to compare 1 to '1'
    if (config.version != settingsVersion) { // eslint-disable-line
      throw new Error('version ' + config.version + ' is not equal to ' + settingsVersion);
    }
    var data = JSON.stringify(config, null, '  ');
    fs.writeFile(configFile, data, 'utf8', callback);
  },

  writeFileSync(configFile, config) {
    // need to be able to compare 1 to '1'
    if (config.version != settingsVersion) { // eslint-disable-line
      throw new Error('version ' + config.version + ' is not equal to ' + settingsVersion);
    }

    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    var data = JSON.stringify(config, null, '  ');
    fs.writeFileSync(configFile, data, 'utf8');
  },

  loadDefault
};
