// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const childProcess = require('child_process');
const path = require('path');

const webpack = require('webpack');

const VERSION = childProcess.execSync('git rev-parse --short HEAD', {cwd: __dirname}).toString();
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const isRelease = process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW.startsWith('release');

const codeDefinitions = {
    __HASH_VERSION__: !isRelease && JSON.stringify(VERSION),
    __CAN_UPGRADE__: isTest || JSON.stringify(process.env.CAN_UPGRADE === 'true'),
    __IS_NIGHTLY_BUILD__: JSON.stringify(process.env.GITHUB_WORKFLOW && process.env.GITHUB_WORKFLOW.startsWith('nightly')),
    __IS_MAC_APP_STORE__: JSON.stringify(process.env.IS_MAC_APP_STORE === 'true'),
    __SKIP_ONBOARDING_SCREENS__: JSON.stringify(process.env.MM_DESKTOP_BUILD_SKIPONBOARDINGSCREENS === 'true'),
    __DISABLE_GPU__: JSON.stringify(process.env.MM_DESKTOP_BUILD_DISABLEGPU === 'true'),
};
codeDefinitions['process.env.NODE_ENV'] = JSON.stringify(process.env.NODE_ENV);
if (isTest) {
    codeDefinitions['process.resourcesPath'] = 'process.env.RESOURCES_PATH';
}

module.exports = {
    mode: isProduction ? 'production' : 'development',
    bail: true,
    plugins: [
        new webpack.DefinePlugin(codeDefinitions),
    ],
    module: {
        rules: [{
            test: /\.(js|jsx|ts|tsx)?$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
        }],
    },
    devtool: isProduction ? undefined : 'inline-source-map',
    resolve: {
        modules: [
            'node_modules',
            './src',
        ],
        alias: {
            renderer: path.resolve(__dirname, 'src/renderer'),
            main: path.resolve(__dirname, './src/main'),
            app: path.resolve(__dirname, './src/app'),
            common: path.resolve(__dirname, './src/common'),
            static: path.resolve(__dirname, './src/assets'),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    output: {
        path: process.env.NODE_ENV === 'test' ? path.resolve(__dirname, 'e2e/dist/') : undefined,
    },
};
