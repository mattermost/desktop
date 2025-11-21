// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const chai = require('chai');
const {ipcRenderer} = require('electron');
const {_electron: electron} = require('playwright');
const ps = require('ps-node');
const {SHOW_SETTINGS_WINDOW} = require('src/common/communication');

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
const userDataDir = path.join(sourceRootDir, 'e2e/testUserData');
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
};
const githubServer = {
    name: 'github',
    url: 'https://github.com/',
    order: 1,
};

const demoConfig = {
    version: 4,
    servers: [exampleServer, githubServer],
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
    lastActiveServer: 0,
    startInFullscreen: false,
    autoCheckForUpdates: true,
    appLanguage: 'en',
    logLevel: 'silly',
    viewLimit: 15,
};

const demoMattermostConfig = {
    ...demoConfig,
    servers: [{
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
            fs.rmSync(userDataDir, {recursive: true, force: true});
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

    clipboard(textToCopy) {
        switch (process.platform) {
        case 'linux':
            execSync(`echo "${textToCopy}" | xsel --clipboard`);
            break;
        case 'win32':
            execSync(`echo ${textToCopy} | clip`);
            break;
        case 'darwin':
            execSync(`pbcopy <<< ${textToCopy}`);
            break;
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
                RESOURCES_PATH: path.join(sourceRootDir, 'e2e/dist'),
                NODE_ENV: 'test',
                ...process.env,
                ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
                ELECTRON_ENABLE_LOGGING: 'true',
                ELECTRON_NO_ATTACH_CONSOLE: 'true',
                NODE_OPTIONS: '--no-warnings',
            },
            executablePath: electronBinaryPath,
            timeout: 60000,
            args: [
                path.join(sourceRootDir, 'e2e/dist'),
                `--user-data-dir=${userDataDir}`,
                '--disable-dev-shm-usage',
                '--disable-dev-mode',
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--no-sandbox',
                '--no-zygote',
                '--disable-software-rasterizer',
                '--disable-breakpad',
                '--disable-features=SpareRendererForSitePerProcess',
                '--disable-features=CrossOriginOpenerPolicy',
                '--disable-renderer-backgrounding',
                '--window-open-file-system',
                '--force-color-profile=srgb',
                '--mute-audio',
                ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
                ...args,
            ],
        };

        const eapp = await electron.launch(options);

        // Wait for windows to be available instead of relying on event
        // Poll for windows with a timeout to handle slow initialization on macOS-15
        const startTime = Date.now();
        const timeout = 30000; // 30 seconds
        let hasWindows = false;

        while (!hasWindows && (Date.now() - startTime) < timeout) {
            try {
                const windows = eapp.windows();
                if (windows.length > 0) {
                    hasWindows = true;
                    break;
                }
            } catch (err) {
                // Ignore errors during polling
            }
            // eslint-disable-next-line no-await-in-loop
            await asyncSleep(100); // Check every 100ms
        }

        if (hasWindows === false) {
            // eslint-disable-next-line no-console
            console.log('Warning: No windows detected within 30 seconds, but continuing anyway');
        } else {
            // Give windows a bit more time to fully initialize and be accessible
            await asyncSleep(500);
        }

        return eapp;
    },

    async getServerMap(app) {
        const map = {};
        await Promise.all(app.windows().
            filter((win) => !win.url().includes('mattermost-desktop://')).
            map(async (win) => {
                return win.evaluate(async () => {
                    if (!window.testHelper) {
                        return null;
                    }
                    return window.testHelper.getViewInfoForTest();
                }).then((result) => {
                    if (result) {
                        if (!map[result.serverName]) {
                            map[result.serverName] = [];
                        }
                        map[result.serverName].push({win, webContentsId: result.webContentsId});
                    }
                });
            }));
        return map;
    },

    async loginToMattermost(window) {
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
        return condition ? it : it.skip;
    },
    isOneOf(platforms) {
        return (platforms.indexOf(process.platform) !== -1);
    },
};
