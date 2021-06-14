// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const childProcess = require('child_process');

const webpack = require('webpack');
const ElectronNativePlugin = require('electron-native-plugin');

const path = require('path');

const VERSION = childProcess.execSync('git rev-parse --short HEAD').toString();
const isProduction = process.env.NODE_ENV === 'production';

const codeDefinitions = {
    __HASH_VERSION__: JSON.stringify(VERSION),
};
codeDefinitions['process.env.NODE_ENV'] = JSON.stringify(process.env.NODE_ENV);

module.exports = {

    // Some plugins cause errors on the app, so use few plugins.
    // https://webpack.js.org/concepts/mode/#mode-production
    mode: isProduction ? 'none' : 'development',
    plugins: [
        new webpack.DefinePlugin(codeDefinitions),
        new ElectronNativePlugin(),
        new webpack.IgnorePlugin(/node-gyp/),
    ],
    devtool: isProduction ? false : '#inline-source-map',
    resolve: {
        alias: {
            renderer: path.resolve(__dirname, 'src/renderer'),
            main: path.resolve(__dirname, './src/main'),
            common: path.resolve(__dirname, './src/common'),
            static: path.resolve(__dirname, './src/assets'),
        },
    },
    module: {
        rules: [
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
            },
        ],
    },
};

/* eslint-enable import/no-commonjs */
