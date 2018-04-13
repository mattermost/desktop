const path = require("path");

// https://storybook.js.org/configurations/custom-webpack-config/#full-control-mode--default
module.exports = (baseConfig, env, defaultConfig) => {
  defaultConfig.resolve.modules = [path.resolve(__dirname, '../node_modules'), 'node_modules'];
  return defaultConfig;
}
