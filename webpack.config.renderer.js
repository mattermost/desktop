'use strict';

const merge = require('webpack-merge');
const base = require('./webpack.config.base');

module.exports = merge(base, {
  entry: {
    index: './src/browser/index.jsx',
    settings: './src/browser/settings.jsx',
    'webview/mattermost': './src/browser/webview/mattermost.js'
  },
  output: {
    path: './src/browser',
    filename: '[name]_bundle.js'
  },
  module: {
    rules: [{
      test: /\.jsx$/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['react'],
          plugins: ['transform-object-rest-spread']
        }
      }
    }]
  },
  node: {
    __filename: false,
    __dirname: false
  },
  target: 'electron-renderer'
});
