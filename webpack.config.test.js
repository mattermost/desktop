// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const merge = require('webpack-merge');

const base = require('./webpack.config.base');

const WEBSERVER_PORT = 9001;

module.exports = merge(base, {
    entry: {
        test: './test/unit/index.js',
    },
    output: {
        path: path.resolve(__dirname, 'dist/tests'),
        filename: '[name]_bundle.js',
    },
    module: {
        rules: [{
            test: /\.(js|jsx)?$/,
            use: ['babel-loader'],
        }],
    },
    externals: {
        puppeteer: 'require("puppeteer")',
        fs: 'require("fs")',
        ws: 'require("ws")',
        child_process: 'require("child_process")',
        dns: 'require("dns")',
        http2: 'require("http2")',
        net: 'require("net")',
        repl: 'require("repl")',
        tls: 'require("tls")',
    },
    node: {
        __filename: false,
        __dirname: false,
    },
    devServer: {
        contentBase: 'src/assets',
        contentBasePublicPath: '/assets',
        inline: true,
        publicPath: '/renderer/',
        port: WEBSERVER_PORT,
    },
    target: 'electron-main',
});

/* eslint-enable import/no-commonjs */
