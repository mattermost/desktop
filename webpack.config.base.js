// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const webpack = require('webpack');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {

  // Some plugins cause errors on the app, so use few plugins.
  // https://webpack.js.org/concepts/mode/#mode-production
  mode: isProduction ? 'none' : 'development',
  plugins: isProduction ? [
    new webpack.DefinePlugin({'process.env.NODE_ENV': JSON.stringify('production')}),
  ] : [],
  devtool: isProduction ? false : '#inline-source-map',
  resolve: {
    alias: {
      renderer: path.resolve(__dirname, 'src/renderer'),
      main: path.resolve(__dirname, './src/main'),
      common: path.resolve(__dirname, './src/common'),
      static: path.resolve(__dirname, './src/assets'),
    }
  }
};

/* eslint-enable import/no-commonjs */
