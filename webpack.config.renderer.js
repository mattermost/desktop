// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const merge = require('webpack-merge');
const CopyPlugin = require('copy-webpack-plugin');

const base = require('./webpack.config.base');

const WEBSERVER_PORT = 9000;

module.exports = merge(base, {
  entry: {
    index: './src/renderer/index.jsx',
    settings: './src/renderer/settings.jsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name]_bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Mattermost Desktop App',
      template: 'src/renderer/index.html',
      chunks: ['index'],
      filename: 'index.html',
    }),
    new HtmlWebpackPlugin({
      title: 'Mattermost Desktop Settings',
      template: 'src/renderer/index.html',
      chunks: ['settings'],
      filename: 'settings.html',
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.[contenthash].css',
      ignoreOrder: true,
      chunkFilename: '[id].[contenthash].css',
    }),
    new CopyPlugin({
      patterns: [{
        from: 'assets/windows/*.ico',
        context: 'src',
      }, {
        from: 'assets/linux/*/*.png',
        context: 'src',
      }, {
        from: 'assets/osx/*.png',
        context: 'src',
      }
      ],
    })
  ],
  module: {
    rules: [{
      test: /\.(js|jsx)?$/,
      use: {
        loader: 'babel-loader',
      },
    }, {
      test: /\.css$/,
      use: [
        MiniCssExtractPlugin.loader,
        'css-loader',
      ],
    }, {
      test: /\.mp3$/,
      use: {
        loader: 'url-loader',
      },
    }, {
      test: /\.(svg|gif)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            publicPath: './assets',
            outputPath: '/../assets',
          },
        },
        {loader: 'image-webpack-loader'},
      ],
    }, {
      test: /\.(eot|ttf|woff|woff2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
      loader: 'file-loader',
      options: {
        name: '[name].[ext]',
        outputPath: '/../assets/fonts',
        publicPath: './assets/fonts',
      },
    }],
  },
  node: {
    __filename: false,
    __dirname: false,
  },
  target: 'electron-renderer',
  devServer: {
    contentBase: 'src/assets',
    contentBasePublicPath: '/assets',
    inline: true,
    publicPath: '/renderer/',
    port: WEBSERVER_PORT,
  },
});

/* eslint-enable import/no-commonjs */
