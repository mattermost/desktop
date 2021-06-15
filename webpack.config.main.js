// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

// This files uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const merge = require('webpack-merge');

const CopyPlugin = require('copy-webpack-plugin');

const base = require('./webpack.config.base');

module.exports = merge(base, {
    entry: {
        index: './src/main/main.js',
        mainWindow: './src/main/preload/mainWindow.js',
        preload: './src/main/preload/mattermost.js',
        modalPreload: './src/main/preload/modalPreload.js',
        loadingScreenPreload: './src/main/preload/loadingScreenPreload.js',
    },
    output: {
        path: path.join(__dirname, 'dist/'),
        filename: '[name].js',
    },
    externals: {
        'macos-notification-state': 'require("macos-notification-state")',
        'windows-focus-assist': 'require("windows-focus-assist")',
    },
    module: {
        rules: [{
            test: /\.js?$/,
            use: {
                loader: 'babel-loader',
                options: {
                    include: ['@babel/plugin-proposal-class-properties'],
                },
            },
        }, {
            test: /\.mp3$/,
            use: {
                loader: 'url-loader',
            },
        },
        {
            test: /\.js$/,
            use:
            [
                'electron-native-patch-loader',
                {
                    loader: 'electron-native-loader',
                    options: {
                        outputPath: path.resolve(__dirname, 'dist'),
                    },
                },
            ],
        },
        {
            test: /\.node$/,
            use: 'electron-native-loader',
        }],
    },
    plugins: [
        new CopyPlugin({
            patterns: [{
                from: 'assets/**/*',
                context: 'src',
            }],
        }),
    ],
    node: {
        __filename: true,
        __dirname: true,
    },
    target: 'electron-main',
});

/* eslint-enable import/no-commonjs */
