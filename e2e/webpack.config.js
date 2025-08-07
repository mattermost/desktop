// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const path = require('path');

const glob = require('glob');
const webpack = require('webpack');

module.exports = {
    mode: 'development',
    entry: {
        e2e: glob.sync('./specs/**/*.js'),
    },
    output: {
        path: path.resolve(__dirname, 'dist/'),
        filename: '[name]_bundle.js',
    },
    plugins: [
        new webpack.DefinePlugin({__IS_MAC_APP_STORE__: false}),
    ],
    externals: {
        electron: 'require("electron")',
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
        'registry-js': 'require("registry-js")',
    },
    module: {
        rules: [{
            test: /\.(js|ts)?$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
        }],
    },
    node: {
        __filename: false,
        __dirname: false,
    },
    target: 'node',
    resolve: {
        modules: [
            'node_modules',
            '../src',
        ],
        alias: {
            src: path.resolve(__dirname, '../src'),
        },
        extensions: ['.ts', '.js'],
    },
};
