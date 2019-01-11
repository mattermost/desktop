const path = require("path");

const rendererConfig = require('../../webpack.config.renderer');

// https://storybook.js.org/configurations/custom-webpack-config/#full-control-mode--default
module.exports = (storybookBaseConfig, configType) => {
  // Avoid conflicting two instances of React due to two package.json structure
  storybookBaseConfig.resolve.modules.unshift(path.resolve(__dirname, '../node_modules'));

  // Use same rules
  storybookBaseConfig.module.rules = rendererConfig.module.rules.concat({
    test: /\.(ttf|woff2?|eot|svg)/,
    use: {
      loader: 'file-loader'
    }
  });
  return storybookBaseConfig;
}
