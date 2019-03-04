// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const merge = require('webpack-merge');

const CopyPlugin = require('copy-webpack-plugin');

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
  plugins: [
    new CopyPlugin([
      { from: 'node_modules/@nornagon/spellchecker/build/Release/spellchecker.node', flatten: true, force: true },
      { from: 'node_modules/@nornagon/cld/build/Release/cld.node', flatten: true, force: true },
    ]),
  ]
  });
