// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import pastDefaultPreferences from './pastDefaultPreferences';

function deepCopy(object) {
  return JSON.parse(JSON.stringify(object));
}

function upgradeV0toV1(configV0) {
  const config = deepCopy(pastDefaultPreferences['1']);
  if (config.version !== 1) {
    throw new Error('pastDefaultPreferences[\'1\'].version is not equal to 1');
  }
  config.teams.push({
    name: 'Primary server',
    url: configV0.url,
  });
  return config;
}

function upgradeV1toV2(configV1) {
  const config = deepCopy(pastDefaultPreferences['2']);
  if (config.version !== 2) {
    throw new Error('pastDefaultPreferences[\'2\'].version is not equal to 2');
  }
  config.servers = configV1.teams;
  delete config.teams;
  return config;
}

export default function upgradeToLatest(config) {
  const configVersion = config.version ? config.version : 0;
  switch (configVersion) {
  case 0:
    return upgradeToLatest(upgradeV0toV1(config));
  case 1:
    return upgradeToLatest(upgradeV1toV2(config));
  default:
    return config;
  }
}
