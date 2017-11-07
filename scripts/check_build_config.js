const buildConfig = require('../src/common/config/buildConfig');

function validateBuildConfig(config) {
  if (config.enableServerManagement === false && config.defaultTeams && config.defaultTeams.length === 0) {
    return {
      result: false,
      message: `When "enableServerManagement: false" is specified in buildConfig.js, "defaultTeams" must have one team at least.\n${JSON.stringify(config, null, 2)}`
    };
  }
  return {result: true};
}

const ret = validateBuildConfig(buildConfig);
if (ret.result === false) {
  throw new Error(ret.message);
}
