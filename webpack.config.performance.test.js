// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const glob = require('glob');
const {merge} = require('webpack-merge');

const test = require('./webpack.config.test');

module.exports = merge(test, {
    entry: {
        e2e: glob.sync('./e2e/performance/**/*.test.js'),
    },
});

/* eslint-enable import/no-commonjs */
