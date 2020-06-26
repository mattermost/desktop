// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This files uses CommonJS.
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
  module: {
    rules: [{
      test: /\.js?$/,
      use: {
        loader: 'babel-loader',
        options: {
          include: ['@babel/plugin-proposal-class-properties']
        }
      },
    },
    {
      test: /registry.node$/,
      loader: 'awesome-node-loader',
      options: {
        name: '[name].[ext]',
        rewritePath: 'node_modules\registry-js\build\Release'
      }
    }
    ],
  },
  node: {
    __filename: true,
    __dirname: false,
  },
  target: 'electron-main',
});

/* eslint-enable import/no-commonjs */
