// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {spawn, exec} = require('child_process');
const path = require('path');

const webpack = require('webpack');

const mainConfig = require('../webpack.config.main.js');
const preloadConfig = require('../webpack.config.preload.js');
const rendererConfig = require('../webpack.config.renderer.js');

let electronProcess = null;

function startElectron() {
    if (electronProcess) {
        electronProcess.removeAllListeners();
    }
    electronProcess = spawn(
        'electron',
        [path.resolve('dist/')],
        {stdio: 'inherit', shell: process.platform === 'win32'},
    );
}

function killProcessTree(pid) {
    return new Promise((resolve) => {
        // On Windows, use taskkill to terminate the process tree
        exec(`taskkill /pid ${pid} /t /f`, (error) => {
            if (error && !error.message.includes('not found')) {
                console.error('Error killing process tree:', error.message);
            }
            resolve();
        });
    });
}

function restartElectron() {
    if (electronProcess) {
        if (process.platform === 'win32') {
            // On Windows, use taskkill to properly terminate the process tree
            killProcessTree(electronProcess.pid).then(() => {
                startElectron();
            });
        } else {
            // On Unix-like systems, use the standard kill method
            electronProcess.kill();
            startElectron();
        }
    } else {
        startElectron();
    }
}

let hasStarted = false;
Promise.all([mainConfig, preloadConfig, rendererConfig].map((config) => {
    return new Promise((resolve) => {
        const compiler = webpack(config);
        compiler.watch({}, (err, stats) => {
            if (err) {
                console.error(err);
            }
            process.stdout.write(stats.toString({colors: true}));
            process.stdout.write('\n');
            if (!stats.hasErrors() && hasStarted) {
                restartElectron();
            }
            resolve();
        });
    });
})).then(() => {
    startElectron();
    hasStarted = true;
});
