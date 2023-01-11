// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
const {merge} = require('webpack-merge');

const base = require('./webpack.config.base');

const WEBSERVER_PORT = (process.env.WEBSERVER_PORT ?? 9001) + 1;

const getRemoteEntry = (resolve) => {
    const script = document.createElement('script');
    window.mattermost.getUrl.then((url) => {
        const parsedURL = new URL(url);
        window.basename = (parsedURL.pathname === '/' ? '' : parsedURL.pathname) || '';
        script.src = `${url}/static/remote_entry.js`;
        script.onload = () => {
            // the injected script has loaded and is available on window
            // we can now resolve this Promise
            const proxy = {
                get: (request) => window.mattermost_webapp.get(request),
                init: (arg) => {
                    try {
                        return window.mattermost_webapp.init(arg);
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error('remote container already initialized');
                        return null;
                    }
                },
            };
            resolve(proxy);
        };
    });

    // inject this script with the src set to the versioned remoteEntry.js
    document.head.appendChild(script);
};

module.exports = merge(base, {
    entry: {
        mattermost: './src/renderer/mattermost_bootstrap.ts',
    },
    output: {
        path: path.resolve(__dirname, 'dist/renderer'),
        publicPath: '/',
        filename: '[name]_bundle.js',
        assetModuleFilename: '[name].[ext]',
    },
    plugins: [
        new webpack.container.ModuleFederationPlugin({
            name: 'index',
            remotes: {
                mattermost_webapp: `promise new Promise(${getRemoteEntry.toString()})`,
            },
            shared: {
                history: {
                    singleton: true,
                    eager: true,
                    import: false,
                },
                react: {
                    singleton: true,
                    eager: true,
                    import: false,
                },
                'react-beautiful-dnd': {
                    singleton: true,
                    eager: true,
                    import: false,
                },
                'react-dom': {
                    singleton: true,
                    eager: true,
                    import: false,
                },
                'react-redux': {
                    singleton: true,
                    eager: true,
                    import: false,
                },
                'react-router-dom': {
                    singleton: true,
                    eager: true,
                    import: false,
                },
            },
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost',
            template: 'src/renderer/mattermost.html',
            chunks: ['mattermost'],
            filename: 'mattermost.html',
        }),
        new MiniCssExtractPlugin({
            filename: 'styles.[contenthash].css',
            ignoreOrder: true,
            chunkFilename: '[id].[contenthash].css',
        }),
    ],
    module: {
        rules: [{
            test: /\.(js|jsx|ts|tsx)?$/,
            use: {
                loader: 'babel-loader',
            },
        }, {
            test: /\.css$/,
            exclude: /\.lazy\.css$/,
            use: [
                MiniCssExtractPlugin.loader,
                'css-loader',
            ],
        }, {
            test: /\.lazy\.css$/,
            use: [
                {
                    loader: 'style-loader',
                    options: {
                        injectType: 'lazyStyleTag',
                    },
                },
                'css-loader',
            ],
        }, {
            test: /\.scss$/,
            use: [
                MiniCssExtractPlugin.loader,
                'css-loader',
                'sass-loader',
            ],
        }, {
            test: /\.mp3$/,
            type: 'asset/inline',
        }, {
            test: /\.(svg|gif)$/,
            type: 'asset/resource',
        }, {
            test: /\.(eot|ttf|woff|woff2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
            type: 'asset/resource',
        }],
    },
    node: {
        __filename: false,
        __dirname: false,
    },
    devServer: {
        port: WEBSERVER_PORT,
    },
});

/* eslint-enable import/no-commonjs */
