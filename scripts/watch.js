// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const electron = require('electron-connect').server.create({path: 'dist/'});
const webpack = require('webpack');

const mainConfig = require('../webpack.config.main.js');
const preloadConfig = require('../webpack.config.preload.js');
const rendererConfig = require('../webpack.config.renderer.js');

Promise.all([mainConfig, preloadConfig, rendererConfig].map((config) => {
    return new Promise((resolve) => {
        const compiler = webpack(config);
        compiler.watch({}, (err, stats) => {
            if (err) {
                console.error(err);
            }
            process.stdout.write(stats.toString({colors: true}));
            process.stdout.write('\n');
            if (!stats.hasErrors()) {
                electron.restart();
            }
            resolve();
        });
    });
})).then(() => electron.start());
