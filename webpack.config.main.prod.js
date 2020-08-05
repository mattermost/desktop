// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This files uses CommonJS.
/* eslint-disable import/no-commonjs */
'use strict';

const merge = require('webpack-merge');

const base = require('./webpack.config.main.dev.js');

delete base.entry;

module.exports = merge(base, {
  entry: {
    main: './src/main/main.js',
    preload: './src/main/preload/mattermost.js'
  }
});

/* eslint-enable import/no-commonjs */
