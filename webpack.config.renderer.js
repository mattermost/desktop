// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const {merge} = require('webpack-merge');

const base = require('./webpack.config.base');

const WEBSERVER_PORT = process.env.WEBSERVER_PORT ?? 9065;

module.exports = merge(base, {
    entry: {
        index: './src/renderer/index.tsx',
        settings: './src/renderer/settings.tsx',
        dropdown: './src/renderer/dropdown.tsx',
        downloadsDropdownMenu: './src/renderer/downloadsDropdownMenu.tsx',
        downloadsDropdown: './src/renderer/downloadsDropdown.tsx',
        urlView: './src/renderer/modals/urlView/urlView.tsx',
        newServer: './src/renderer/modals/newServer/newServer.tsx',
        editServer: './src/renderer/modals/editServer/editServer.tsx',
        removeServer: './src/renderer/modals/removeServer/removeServer.tsx',
        loginModal: './src/renderer/modals/login/login.tsx',
        permissionModal: './src/renderer/modals/permission/permission.tsx',
        certificateModal: './src/renderer/modals/certificate/certificate.tsx',
        loadingScreen: './src/renderer/modals/loadingScreen/index.tsx',
        welcomeScreen: './src/renderer/modals/welcomeScreen/welcomeScreen.tsx',
    },
    output: {
        path: path.resolve(__dirname, 'dist/renderer'),
        filename: '[name]_bundle.js',
        assetModuleFilename: '[name].[ext]',
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
            chunks: ['dropdown'],
            filename: 'dropdown.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Downloads',
            template: 'src/renderer/index.html',
            chunks: ['downloadsDropdown'],
            filename: 'downloadsDropdown.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Downloads',
            template: 'src/renderer/index.html',
            chunks: ['downloadsDropdownMenu'],
            filename: 'downloadsDropdownMenu.html',
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
            chunks: ['editServer'],
            filename: 'editServer.html',
        }),
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['removeServer'],
            filename: 'removeServer.html',
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
        new HtmlWebpackPlugin({
            title: 'Mattermost Desktop Settings',
            template: 'src/renderer/index.html',
            chunks: ['welcomeScreen'],
            filename: 'welcomeScreen.html',
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
    target: 'electron-renderer',
    devServer: {
        port: WEBSERVER_PORT,
    },
});

/* eslint-enable import/no-commonjs */
