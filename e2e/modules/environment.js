// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const path = require('path');

const ps = require('ps-node');

const {_electron: electron} = require('playwright');
const chai = require('chai');
const {ipcRenderer} = require('electron');

const {SHOW_SETTINGS_WINDOW} = require('../../src/common/communication');

const {asyncSleep, mkDirAsync, rmDirAsync, unlinkAsync} = require('./utils');
chai.should();

const sourceRootDir = path.join(__dirname, '../..');
const electronBinaryPath = (() => {
    if (process.platform === 'darwin') {
        return path.join(sourceRootDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
    }
    const exeExtension = (process.platform === 'win32') ? '.exe' : '';
    return path.join(sourceRootDir, 'node_modules/electron/dist/electron' + exeExtension);
})();
const userDataDir = path.join(sourceRootDir, 'e2e/testUserData/');
const configFilePath = path.join(userDataDir, 'config.json');
const downloadsFilePath = path.join(userDataDir, 'downloads.json');
const downloadsLocation = path.join(userDataDir, 'Downloads');
const boundsInfoPath = path.join(userDataDir, 'bounds-info.json');
const appUpdatePath = path.join(userDataDir, 'app-update.yml');
const exampleURL = 'http://example.com/';
const mattermostURL = process.env.MM_TEST_SERVER_URL || 'http://localhost:8065/';

if (process.platform === 'win32') {
    const robot = require('robotjs');
    robot.mouseClick();
}

const exampleServer = {
    name: 'example',
    url: exampleURL,
    order: 0,
    tabs: [
        {
            name: 'TAB_MESSAGING',
            order: 0,
            isOpen: true,
        },
        {
            name: 'TAB_FOCALBOARD',
            order: 1,
        },
        {
            name: 'TAB_PLAYBOOKS',
            order: 2,
        },
    ],
    lastActiveTab: 0,
};
const githubServer = {
    name: 'github',
    url: 'https://github.com/',
    order: 1,
    tabs: [
        {
            name: 'TAB_MESSAGING',
            order: 0,
            isOpen: true,
        },
        {
            name: 'TAB_FOCALBOARD',
            order: 1,
            isOpen: true,
        },
        {
            name: 'TAB_PLAYBOOKS',
            order: 2,
            isOpen: true,
        },
    ],
    lastActiveTab: 0,
};

const demoConfig = {
    version: 3,
    teams: [exampleServer, githubServer],
    showTrayIcon: false,
    trayIconTheme: 'light',
    minimizeToTray: false,
    notifications: {
        flashWindow: 0,
        bounceIcon: false,
        bounceIconType: 'informational',
    },
    showUnreadBadge: true,
    useSpellChecker: true,
    enableHardwareAcceleration: true,
    autostart: true,
    hideOnStart: false,
    spellCheckerLocales: [],
    darkMode: false,
    lastActiveTeam: 0,
    startInFullscreen: false,
    autoCheckForUpdates: true,
    appLanguage: 'en',
    logLevel: 'silly',
};

const demoMattermostConfig = {
    ...demoConfig,
    teams: [{
        ...exampleServer,
        url: mattermostURL,
    }, githubServer],
};

const cmdOrCtrl = process.platform === 'darwin' ? 'command' : 'control';

module.exports = {
    sourceRootDir,
    configFilePath,
    downloadsFilePath,
    downloadsLocation,
    userDataDir,
    boundsInfoPath,
    appUpdatePath,
    exampleURL,
    mattermostURL,
    demoConfig,
    demoMattermostConfig,
    cmdOrCtrl,

    async clearElectronInstances() {
        return new Promise((resolve, reject) => {
            ps.lookup({
                command: process.platform === 'darwin' ? 'Electron' : 'electron',
            }, (err, resultList) => {
                if (err) {
                    reject(err);
                }
                resultList.forEach((process) => {
                    if (process && process.command === electronBinaryPath && !process.arguments.some((arg) => arg.includes('electron-mocha'))) {
                        ps.kill(process.pid);
                    }
                });
                resolve();
            });
        });
    },

    cleanTestConfig() {
        [configFilePath, downloadsFilePath, boundsInfoPath].forEach((file) => {
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
    async cleanTestConfigAsync() {
        await Promise.all(
            [configFilePath, downloadsFilePath, boundsInfoPath].map((file) => {
                return unlinkAsync(file);
            }),
        );
    },

    cleanDataDir() {
        try {
            fs.rmdirSync(userDataDir, {recursive: true});
        } catch (err) {
            if (err.code !== 'ENOENT') {
                // eslint-disable-next-line no-console
                console.error(err);
            }
        }
    },
    cleanDataDirAsync() {
        return rmDirAsync(userDataDir);
    },

    createTestUserDataDir() {
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir);
        }
    },
    async createTestUserDataDirAsync() {
        await mkDirAsync(userDataDir);
    },

    async getApp(args = []) {
        const options = {
            downloadsPath: downloadsLocation,
            env: {
                ...process.env,
                RESOURCES_PATH: userDataDir,
            },
            executablePath: electronBinaryPath,
            args: [`${path.join(sourceRootDir, 'dist')}`, `--user-data-dir=${userDataDir}`, '--disable-dev-mode', '--no-sandbox', ...args],
        };

        // if (process.env.MM_DEBUG_SETTINGS) {
        //     options.chromeDriverLogPath = './chromedriverlog.txt';
        // }
        // if (process.platform === 'darwin' || process.platform === 'linux') {
        //     // on a mac, debugging port might conflict with other apps
        //     // this changes the default debugging port so chromedriver can run without issues.
        //     options.chromeDriverArgs.push('remote-debugging-port=9222');
        //}
        return electron.launch(options).then(async (eapp) => {
            await eapp.evaluate(async ({app}) => {
                const promise = new Promise((resolve) => {
                    app.on('e2e-app-loaded', () => {
                        resolve();
                    });
                });
                return promise;
            });
            return eapp;
        });
    },

    async getServerMap(app) {
        const map = {};
        await Promise.all(app.windows().map(async (win) => {
            return win.evaluate(async () => {
                if (!window.testHelper) {
                    return null;
                }
                const info = await window.testHelper.getViewInfoForTest();
                return {viewName: `${info.serverName}___${info.viewType}`, webContentsId: info.webContentsId};
            }).then((result) => {
                if (result) {
                    map[result.viewName] = {win, webContentsId: result.webContentsId};
                }
            });
        }));
        return map;
    },

    async loginToMattermost(window) {
        // Do this twice because sometimes the app likes to load the login screen, then go to Loading... again
        await asyncSleep(1000);
        await window.waitForSelector('#input_loginId');
        await window.waitForSelector('#input_password-input');
        await window.waitForSelector('#saveSetting');

        await window.type('#input_loginId', process.env.MM_TEST_USER_NAME);
        await window.type('#input_password-input', process.env.MM_TEST_PASSWORD);
        await window.click('#saveSetting');
    },

    async openDownloadsDropdown(app) {
        const mainWindow = app.windows().find((window) => window.url().includes('index'));
        await mainWindow.waitForLoadState();
        await mainWindow.bringToFront();

        const dlButtonLocator = await mainWindow.waitForSelector('.DownloadsDropdownButton');
        await dlButtonLocator.click();
        await asyncSleep(500);

        const downloadsWindow = app.windows().find((window) => window.url().includes('downloadsDropdown.html'));
        await downloadsWindow.waitForLoadState();
        await downloadsWindow.bringToFront();
        await downloadsWindow.isVisible('.DownloadsDropdown');
        return downloadsWindow;
    },

    async downloadsDropdownIsOpen(app) {
        const downloadsWindow = app.windows().find((window) => window.url().includes('downloadsDropdown.html'));
        const result = await downloadsWindow.isVisible('.DownloadsDropdown');
        return result;
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
