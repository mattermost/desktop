// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

// This files uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const merge = require('webpack-merge');

const base = require('./webpack.config.base');

module.exports = merge(base, {
  entry: {
    index: './src/main/main.js',
    preload: './src/main/preload/mattermost.js'
  },
  output: {
    path: path.join(__dirname, 'dist/'),
    filename: '[name].js',
  },
  module: {
    rules: [{
      test: /\.js?$/,
      use: {
        loader: 'babel-loader',
        options: {
          include: ['@babel/plugin-proposal-class-properties']
        }
      },
    }],
  },
  node: {
    __filename: true,
    __dirname: true,
  },
  target: 'electron-main',
});

/* eslint-enable import/no-commonjs */
