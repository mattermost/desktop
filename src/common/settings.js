// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';
import path from 'path';

import buildConfig from './config/buildConfig';

function merge(base, target) {
  return Object.assign({}, base, target);
}

import defaultPreferences from './config/defaultPreferences';
import upgradePreferences from './config/upgradePreferences';

function getPreconfigFilePath(appName) {
  const file = 'preconfig.json';
  switch (process.platform) {
  case 'win32':
    return `C:\\ProgramData\\${appName}\\${file}`;
  case 'darwin':
    return `/Library/Application Support/${appName}/${file}`;
  case 'linux':
    return `/etc/${appName.toLowerCase()}/${file}`;
  default:
    return '';
  }
}

function loadDefault(spellCheckerLocale, appName) {
  let config = null;
  const preconfigFile = getPreconfigFilePath(appName);
  if (fs.existsSync(preconfigFile)) {
    console.log('Found pre-config file:', preconfigFile);
    try {
      const preconfig = JSON.parse(fs.readFileSync(preconfigFile)).defaultPreferences;
      config = upgradePreferences(preconfig);
    } catch (err) {
      console.log(err);
    }
  }
  if (config === null) {
    config = JSON.parse(JSON.stringify(defaultPreferences));
  }

  Object.assign(config, {
    spellCheckerLocale: spellCheckerLocale || defaultPreferences.spellCheckerLocale || 'en-US',
  });
  return config;
}

function hasBuildConfigDefaultTeams(config) {
  return config.defaultTeams.length > 0;
}

function upgrade(config) {
  return upgradePreferences(config);
}

export default {
  version: defaultPreferences.version,

  upgrade,

  readFileSync(configFile, appName) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (config.version === defaultPreferences.version) {
      const defaultConfig = loadDefault(null, appName);
      return merge(defaultConfig, config);
    }
    return config;
  },

  writeFile(configFile, config, callback) {
    if (config.version !== defaultPreferences.version) {
      throw new Error('version ' + config.version + ' is not equal to ' + defaultPreferences.version);
    }
    const data = JSON.stringify(config, null, '  ');
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

    const data = JSON.stringify(config, null, '  ');
    fs.writeFileSync(configFile, data, 'utf8');
  },

  loadDefault,

  mergeDefaultTeams(teams) {
    const newTeams = [];
    if (hasBuildConfigDefaultTeams(buildConfig)) {
      newTeams.push(...JSON.parse(JSON.stringify(buildConfig.defaultTeams)));
    }
    if (buildConfig.enableServerManagement) {
      newTeams.push(...JSON.parse(JSON.stringify(teams)));
    }
    return newTeams;
  },
};
