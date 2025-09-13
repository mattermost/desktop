// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

const {merge} = require('webpack-merge');

const base = require('./webpack.config.base');

module.exports = merge(base, {
    entry: {
        internalAPI: './src/app/preload/internalAPI.js',
        externalAPI: './src/app/preload/externalAPI.ts',
    },
    externalsPresets: {
        electronPreload: true,
    },
    node: {
        __filename: true,
        __dirname: true,
    },
    target: 'electron-preload',
});
