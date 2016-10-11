module.exports = {
  entry: {
    index: './src/browser/index.jsx',
    settings: './src/browser/settings.jsx',
    'webview/mattermost': './src/browser/webview/mattermost.js'
  },
  output: {
    path: './dist/browser',
    filename: '[name].js'
  },
  module: {
    loaders: [{
      test: /\.json$/,
      loader: 'json'
    }, {
      test: /\.jsx$/,
      loader: 'babel',
      query: {
        presets: ['react']
      }
    }]
  },
  node: {
    __filename: false,
    __dirname: false
  },
  target: 'electron-renderer'
};
