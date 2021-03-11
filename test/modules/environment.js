// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const path = require('path');

const Application = require('spectron').Application;
const chai = require('chai');
const {ipcRenderer} = require('electron');

const {SHOW_SETTINGS_WINDOW} = require('../../src/common/communication');
chai.should();

const sourceRootDir = path.join(__dirname, '../..');
const electronBinaryPath = (() => {
    if (process.platform === 'darwin') {
        return path.join(sourceRootDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
    }
    const exeExtension = (process.platform === 'win32') ? '.exe' : '';
    return path.join(sourceRootDir, 'node_modules/electron/dist/electron' + exeExtension);
})();
const userDataDir = path.join(sourceRootDir, 'test/testUserData/');
const configFilePath = path.join(userDataDir, 'config.json');
const boundsInfoPath = path.join(userDataDir, 'bounds-info.json');
const mattermostURL = 'http://example.com/';

module.exports = {
    sourceRootDir,
    configFilePath,
    userDataDir,
    boundsInfoPath,
    mattermostURL,

    cleanTestConfig() {
        [configFilePath, boundsInfoPath].forEach((file) => {
            try {
                fs.unlinkSync(file);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    // eslint-disable-next-line no-console
                    console.error(err);
                }
            }
        });
    },

    createTestUserDataDir() {
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir);
        }
    },

    getSpectronApp() {
        const options = {
            path: electronBinaryPath,
            args: [`${path.join(sourceRootDir, 'dist')}`, `--data-dir=${userDataDir}`, '--disable-dev-mode'],
            chromeDriverArgs: [],
        };
        if (process.env.MM_DEBUG_SETTINGS) {
            options.chromeDriverLogPath = './chromedriverlog.txt';
        }
        if (process.platform === 'darwin' || process.platform === 'linux') {
            // on a mac, debbuging port might conflict with other apps
            // this changes the default debugging port so chromedriver can run without issues.
            options.chromeDriverArgs.push('remote-debugging-port=9222');
        }
        return new Application(options);
    },

    addClientCommands(client) {
        client.addCommand('loadSettingsPage', function async() {
            ipcRenderer.send(SHOW_SETTINGS_WINDOW);
        });
        client.addCommand('isNodeEnabled', function async() {
            return this.execute(() => {
                try {
                    if (require('child_process')) {
                        return true;
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            }).then((requireResult) => {
                return requireResult.value;
            });
        });
        client.addCommand('waitForAppOptionsAutoSaved', function async() {
            const ID_APP_OPTIONS_SAVE_INDICATOR = '#appOptionsSaveIndicator';
            const TIMEOUT = 5000;
            return this.
                waitForVisible(ID_APP_OPTIONS_SAVE_INDICATOR, TIMEOUT).
                waitForVisible(ID_APP_OPTIONS_SAVE_INDICATOR, TIMEOUT, true);
        });
    },

    // execute the test only when `condition` is true
    shouldTest(it, condition) {
    // eslint-disable-next-line no-only-tests/no-only-tests
        return condition ? it : it.skip;
    },
    isOneOf(platforms) {
        return (platforms.indexOf(process.platform) !== -1);
    },
};
