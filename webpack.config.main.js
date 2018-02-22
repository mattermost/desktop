'use strict';

const merge = require('webpack-merge');

const base = require('./webpack.config.base');

module.exports = merge(base, {
  entry: './src/main.js',
  output: {
    filename: './src/[name]_bundle.js',
  },
  node: {
    __filename: true,
    __dirname: true,
  },
  target: 'electron-main',
});
