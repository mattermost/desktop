// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const webpack = require('webpack');
const electron = require('electron-connect').server.create({path: 'dist/'});

const mainConfig = require('../webpack.config.main.js');
const rendererConfig = require('../webpack.config.renderer.js');

let started = false;

const mainCompiler = webpack(mainConfig);
mainCompiler.watch({}, (err, stats) => {
    process.stdout.write(stats.toString({colors: true}));
    process.stdout.write('\n');
    if (!stats.hasErrors()) {
        if (started) {
            electron.restart();
        } else {
            electron.start();
            started = true;
        }
    }
});

const preloadCompiler = webpack(rendererConfig);
preloadCompiler.watch({}, (err) => {
    if (err) {
        console.log(err);
    }
});
