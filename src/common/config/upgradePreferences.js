const pastDefaultPreferences = require('./pastDefaultPreferences');

function deepCopy(object) {
  return JSON.parse(JSON.stringify(object));
}

function upgradeV0toV1(configV0) {
  const config = deepCopy(pastDefaultPreferences['1']);
  if (config.version !== 1) {
    throw new Error('pastDefaultPreferences[\'1\'].version is not equal to 1');
  }
  config.teams.push({
    name: 'Primary team',
    url: configV0.url
  });
  return config;
}

function upgradeToLatest(config) {
  var configVersion = config.version ? config.version : 0;
  switch (configVersion) {
  case 0:
    return upgradeToLatest(upgradeV0toV1(config));
  default:
    return config;
  }
}

module.exports = upgradeToLatest;
