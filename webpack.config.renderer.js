// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */

module.exports = {
  module: {
    rules: [{
      test: /\.(js|jsx)?$/,
      use: {
        loader: 'babel-loader',
      },
    }, {
      test: /\.mp3$/,
      use: {
        loader: 'url-loader',
      },
    }, {
      test: /\.(svg)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            name: '[hash].[ext]',
            publicPath: './',
          },
        },
        {loader: 'image-webpack-loader'},
      ],
    }, {
      test: /\.(eot|ttf|woff|woff2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
      loader: 'file-loader',
      options: {
        name: '[name].[ext]',
      },
    }],
  },
};

/* eslint-enable import/no-commonjs */
