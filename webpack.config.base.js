// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const childProcess = require('child_process');

const webpack = require('webpack');

const path = require('path');

const VERSION = childProcess.execSync('git rev-parse --short HEAD').toString();
const isProduction = process.env.NODE_ENV === 'production';
const isRelease = process.env.CIRCLE_BRANCH && process.env.CIRCLE_BRANCH.startsWith('release-');

const codeDefinitions = {
    __HASH_VERSION__: !isRelease && JSON.stringify(VERSION),
    __CAN_UPGRADE__: JSON.stringify(true), // we should set this to false when working on a store version. Hardcoding for now.
    __IS_NIGHTLY_BUILD__: JSON.stringify(process.env.CIRCLE_BRANCH === 'nightly'),
    __IS_MAC_APP_STORE__: JSON.stringify(process.env.IS_MAC_APP_STORE === 'true'),
};
codeDefinitions['process.env.NODE_ENV'] = JSON.stringify(process.env.NODE_ENV);

module.exports = {

    // Some plugins cause errors on the app, so use few plugins.
    // https://webpack.js.org/concepts/mode/#mode-production
    mode: isProduction ? 'none' : 'development',
    plugins: [
        new webpack.DefinePlugin(codeDefinitions),
    ],
    devtool: isProduction ? false : '#inline-source-map',
    resolve: {
        alias: {
            renderer: path.resolve(__dirname, 'src/renderer'),
            main: path.resolve(__dirname, './src/main'),
            common: path.resolve(__dirname, './src/common'),
            static: path.resolve(__dirname, './src/assets'),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
};

/* eslint-enable import/no-commonjs */
