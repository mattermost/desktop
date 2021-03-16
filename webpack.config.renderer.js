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

const base = require('./webpack.config.base');

const WEBSERVER_PORT = 9001;

module.exports = merge(base, {
    entry: {
        index: './src/renderer/index.jsx',
        settings: './src/renderer/settings.jsx',
        urlView: './src/renderer/modals/urlView/urlView.jsx',
        newServer: './src/renderer/modals/newServer/newServer.jsx',
        loginModal: './src/renderer/modals/login/login.jsx',
        permissionModal: './src/renderer/modals/permission/permission.jsx',
        certificateModal: './src/renderer/modals/certificate/certificate.jsx',
        loadingScreen: './src/renderer/modals/loadingScreen/index.jsx',
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
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['urlView'],
            filename: 'urlView.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['newServer'],
            filename: 'newServer.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['loginModal'],
            filename: 'loginModal.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['permissionModal'],
            filename: 'permissionModal.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['certificateModal'],
            filename: 'certificateModal.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['loadingScreen'],
            filename: 'loadingScreen.html',
        }),
        new MiniCssExtractPlugin({
            filename: 'styles.[contenthash].css',
            ignoreOrder: true,
            chunkFilename: '[id].[contenthash].css',
        }),
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
