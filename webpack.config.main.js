/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const merge = require('webpack-merge');

const base = require('./webpack.config.base');

module.exports = merge(base, {
  entry: './src/main.js',
  output: {
    path: path.join(__dirname, 'src'),
    filename: '[name]_bundle.js',
  },
  node: {
    __filename: true,
    __dirname: true,
  },
  target: 'electron-main',
});
