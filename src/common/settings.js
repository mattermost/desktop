'use strict';

const fs = require('fs');
const path = require('path');
const buildConfig = require('./config/buildConfig');

function merge(base, target) {
  return Object.assign({}, base, target);
}

const defaultPreferences = require('./config/defaultPreferences');
const upgradePreferences = require('./config/upgradePreferences');

function loadDefault(spellCheckerLocale) {
  const config = JSON.parse(JSON.stringify(defaultPreferences));
  return Object.assign({}, config, {
    spellCheckerLocale: spellCheckerLocale || defaultPreferences.pellCheckerLocale || 'en-US'
  });
}

function hasBuildConfigDefaultTeams(config) {
  return config.defaultTeams.length > 0;
}

function upgrade(config) {
  return upgradePreferences(config);
}

module.exports = {
  version: defaultPreferences.version,

  upgrade,

  readFileSync(configFile) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (config.version === defaultPreferences.version) {
      const defaultConfig = loadDefault();
      return merge(defaultConfig, config);
    }
    return config;
  },

  writeFile(configFile, config, callback) {
    if (config.version !== defaultPreferences.version) {
      throw new Error('version ' + config.version + ' is not equal to ' + defaultPreferences.version);
    }
    var data = JSON.stringify(config, null, '  ');
    fs.writeFile(configFile, data, 'utf8', callback);
  },

  writeFileSync(configFile, config) {
    if (config.version !== defaultPreferences.version) {
      throw new Error('version ' + config.version + ' is not equal to ' + defaultPreferences.version);
    }

    const dir = path.dirname(configFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    var data = JSON.stringify(config, null, '  ');
    fs.writeFileSync(configFile, data, 'utf8');
  },

  loadDefault,

  mergeDefaultTeams(teams) {
    const newTeams = [];
    if (hasBuildConfigDefaultTeams(buildConfig)) {
      newTeams.push(...JSON.parse(JSON.stringify(buildConfig.defaultTeams)));
    }
    newTeams.push(...JSON.parse(JSON.stringify(teams)));
    return newTeams;
  }
};
