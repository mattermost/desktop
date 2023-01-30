// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const glob = require('glob');
const {merge} = require('webpack-merge');

const base = require('./webpack.config.base');

const WEBSERVER_PORT = process.env.WEBSERVER_PORT ?? 9001;

module.exports = merge(base, {
    entry: {
        e2e: glob.sync('./e2e/performance/**/*.test.js'),
    },
    output: {
        path: path.resolve(__dirname, 'dist/tests'),
        filename: '[name]_bundle.js',
    },
    module: {
        rules: [{
            test: /\.(js|jsx|ts|tsx)?$/,
            use: ['babel-loader', 'shebang-loader'],
        }],
    },
    externals: {
        fs: 'require("fs")',
        ws: 'require("ws")',
        child_process: 'require("child_process")',
        dns: 'require("dns")',
        http2: 'require("http2")',
        net: 'require("net")',
        repl: 'require("repl")',
        tls: 'require("tls")',
        playwright: 'require("playwright")',
        robotjs: 'require("robotjs")',
    },
    node: {
        __filename: false,
        __dirname: false,
    },
    devServer: {
        port: WEBSERVER_PORT,
    },
    target: 'electron-main',
});

/* eslint-enable import/no-commonjs */
