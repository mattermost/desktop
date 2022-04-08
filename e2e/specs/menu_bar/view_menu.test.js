// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

async function setupPromise(window, id) {
    const promise = new Promise((resolve) => {
        const browserView = window.getBrowserViews().find((view) => view.webContents.id === id);
        browserView.webContents.on('did-finish-load', () => {
            resolve();
        });
    });
    await promise;
    return true;
}

function robotTextInput(txt) {
    for (let i = 0; i < txt.length; i++) {
        robot.keyTap(txt[i]);
    }
}

function robotKeyTaps(n, ...params) {
    for (let i = 0; i < n; i++) {
        robot.keyTap(...params);
    }
}

function openDevToolsCommandPalette() {
    const modifierKeys = process.platform === 'darwin' ? ['command'] : ['control'];
    robotKeyTaps(1, 'p', [...modifierKeys, 'shift']);
}

async function openDevToolsConsoleTab() {
    openDevToolsCommandPalette();
    await asyncSleep(1500);
    robotTextInput('con', 1200); // search for console command
    await asyncSleep(500);
    robotKeyTaps(1, 'enter');
}

async function clickThreeDotMenu(app) {
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    await mainWindow.click('button.three-dot-menu');
}

async function windowEventPromise(app) {
    return new Promise((res) => {
        app.on('window', (window) => {
            res(window);
        });
    });
}

function windowsDialogEventPromises(app, limit) {
    return app.windows().map((window) => {
        return new Promise((res, rej) => {
            window.on('dialog', (e) => {
                res(e);
            });
            setTimeout(rej, limit);
        });
    });
}

describe('menu/view', function desc() {
    this.timeout(60000);

    const config = env.demoMattermostConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
    });

    it('MM-T813 Control+F should focus the search bar in Mattermost', async () => {
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#searchBox');
        robot.keyTap('f', [process.platform === 'darwin' ? 'command' : 'control']);
        await asyncSleep(500);
        const isFocused = await firstServer.$eval('#searchBox', (el) => el === document.activeElement);
        isFocused.should.be.true;
        const text = await firstServer.inputValue('#searchBox');
        text.should.include('in:');
    });

    it('MM-T816 Toggle Full Screen in the Menu Bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchBox');
            let currentWidth = await firstServer.evaluate('window.outerWidth');
            let currentHeight = await firstServer.evaluate('window.outerHeight');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('v');
            robot.keyTap('t');
            robot.keyTap('enter');
            await asyncSleep(1000);
            const fullScreenWidth = await firstServer.evaluate('window.outerWidth');
            const fullScreenHeight = await firstServer.evaluate('window.outerHeight');
            fullScreenWidth.should.be.greaterThan(currentWidth);
            fullScreenHeight.should.be.greaterThan(currentHeight);
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('v');
            robot.keyTap('t');
            robot.keyTap('enter');
            await asyncSleep(1000);
            currentWidth = await firstServer.evaluate('window.outerWidth');
            currentHeight = await firstServer.evaluate('window.outerHeight');
            currentWidth.should.be.lessThan(fullScreenWidth);
            currentHeight.should.be.lessThan(fullScreenHeight);
        }
    });

    it('MM-T817 Actual Size Zoom in the menu bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.not.be.null;
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('v');
            robot.keyTap('a');
            const zoomLevel = await mainWindow.evaluate('window.devicePixelRatio');
            zoomLevel.should.be.equal(1);
        }
    });

    it('MM-T818 Zoom in from the menu bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchBox');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('v');
            robot.keyTap('z');
            robot.keyTap('enter');
            const zoomLevel = await firstServer.evaluate('window.devicePixelRatio');
            zoomLevel.should.be.greaterThan(1);
        }
    });

    it('MM-T819 Zoom out from the menu bar', async () => {
        if (process.platform === 'win32' || process.platform === 'linux') {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchBox');
            await mainWindow.click('button.three-dot-menu');
            robot.keyTap('v');
            robot.keyTap('z');
            robot.keyTap('z');
            robot.keyTap('enter');
            const zoomLevel = await firstServer.evaluate('window.devicePixelRatio');
            zoomLevel.should.be.lessThan(1);
        }
    });

    describe('Reload', () => {
        let browserWindow;
        let webContentsId;

        beforeEach(async () => {
            const mainWindow = await this.app.firstWindow();
            browserWindow = await this.app.browserWindow(mainWindow);
            webContentsId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;

            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        });

        it('MM-T814 should reload page when pressing Ctrl+R', async () => {
            const check = browserWindow.evaluate(setupPromise, webContentsId);
            await asyncSleep(500);
            robot.keyTap('r', ['control']);
            const result = await check;
            result.should.be.true;
        });

        it('MM-T815 should reload page when pressing Ctrl+Shift+R', async () => {
            const check = browserWindow.evaluate(setupPromise, webContentsId);
            await asyncSleep(500);
            robot.keyTap('r', ['control', 'shift']);
            const result = await check;
            result.should.be.true;
        });
    });

    describe('Toggle DevTools', () => {
        const CharPerMin = 600;
        const DelayBetweenInputs = 500; // ms
        const DevToolsLoadTime = 7000; // ms
        const DevToolsLoadTimeBuffer = 10000; // ms
        const MaxDialogEventWaitTime = 6000; // ms
        beforeEach(async () => {
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        });

        it('MM-T820 should open dev tools for Application Wrapper when pressing keyboard shortcuts', async () => {
            const macModifierKeys = ['command', 'alt'];
            const winModifierKeys = ['shift', 'control'];

            const windowLoaded = windowEventPromise(this.app);
            robotKeyTaps(1, 'i', process.platform === 'darwin' ? macModifierKeys : winModifierKeys);

            const window = await windowLoaded;
            const windowTitle = await window.title();

            const isWindowTitleDevTools = windowTitle === 'DevTools';
            isWindowTitleDevTools.should.be.true;
        });

        it('MM-T820 dev tools opened through keyboard shortcuts should point to index.html', async () => {
            const macModifierKeys = ['command', 'alt'];
            const winModifierKeys = ['shift', 'control'];

            robotKeyTaps(1, 'i', process.platform === 'darwin' ? macModifierKeys : winModifierKeys);

            // check the url
            await asyncSleep(DevToolsLoadTime);
            await openDevToolsConsoleTab();

            const allWindowsDialogEventListener = windowsDialogEventPromises(this.app, MaxDialogEventWaitTime);
            await asyncSleep(DelayBetweenInputs);
            robot.typeStringDelayed('alert (window?.location?.href)', CharPerMin);
            await asyncSleep(DelayBetweenInputs);
            robotKeyTaps(1, 'enter');

            const windowAlertDialog = await Promise.any(allWindowsDialogEventListener);
            const alertMsg = windowAlertDialog?.message();
            const devToolsPointsToIndexHtml = alertMsg.endsWith('index.html');
            devToolsPointsToIndexHtml.should.be.true;
        });

        it('MM-T820 should open dev tools for Application Wrapper through menu, View > Developer Tools for Application Wrapper', async () => {
            const windowLoaded = windowEventPromise(this.app);

            if (process.platform === 'darwin') {
                robotKeyTaps(1, 'f2', ['control']);
                robotKeyTaps(3, 'right');
                robotKeyTaps(1, 'enter');
                robotKeyTaps(2, 'up');
                robotKeyTaps(1, 'enter');
            } else {
                await clickThreeDotMenu(this.app);
                robotKeyTaps(3, 'down');
                robotKeyTaps(1, 'right');
                robotKeyTaps(2, 'up');
                robotKeyTaps(2, 'enter');
            }

            const window = await windowLoaded;
            const windowTitle = await window.title();

            const isWindowTitleDevTools = windowTitle === 'DevTools';
            isWindowTitleDevTools.should.be.true;
        });

        it('MM-T820 dev tools opened through menu, should point to index.html', async () => {
            if (process.platform === 'darwin') {
                robotKeyTaps(1, 'f2', ['control']);
                robotKeyTaps(3, 'right');
                robotKeyTaps(1, 'enter');
                robotKeyTaps(2, 'up');
                robotKeyTaps(1, 'enter');
            } else {
                await clickThreeDotMenu(this.app);
                robotKeyTaps(3, 'down');
                robotKeyTaps(1, 'right');
                robotKeyTaps(2, 'up');
                robotKeyTaps(2, 'enter');
            }

            // check the url
            await asyncSleep(DevToolsLoadTime);
            await openDevToolsConsoleTab();

            const allWindowsDialogEventListener = windowsDialogEventPromises(this.app, MaxDialogEventWaitTime);
            await asyncSleep(DelayBetweenInputs);
            robot.typeStringDelayed('alert (window?.location?.href)', CharPerMin);
            await asyncSleep(DelayBetweenInputs);
            robotKeyTaps(1, 'enter');

            const windowAlertDialog = await Promise.any(allWindowsDialogEventListener);
            const alertMsg = windowAlertDialog?.message();
            const devToolsPointsToIndexHtml = alertMsg.endsWith('index.html');
            devToolsPointsToIndexHtml.should.be.true;
        });

        it('MM-T821 should open dev tools for Current Server through menu, View > Developer Tools for Current Server', async () => {
            const windowLoaded = windowEventPromise(this.app);
            if (process.platform === 'darwin') {
                robotKeyTaps(1, 'f2', ['control']);
                robotKeyTaps(3, 'right');
                robotKeyTaps(1, 'enter');
                robotKeyTaps(1, 'up');
                robotKeyTaps(1, 'enter');
            } else {
                await clickThreeDotMenu(this.app);
                robotKeyTaps(3, 'down');
                robotKeyTaps(1, 'right');
                robotKeyTaps(1, 'up');
                robotKeyTaps(1, 'enter');
            }

            const window = await windowLoaded;
            const windowTitle = await window.title();

            const isWindowTitleDevTools = windowTitle === 'DevTools';
            isWindowTitleDevTools.should.be.true;
        });

        it('MM-T821 dev tools should point to localhost:8065 ', async () => {
            // check the url
            await asyncSleep(DevToolsLoadTimeBuffer);
            await openDevToolsConsoleTab();

            const allWindowsDialogEventListener = windowsDialogEventPromises(this.app, MaxDialogEventWaitTime);
            await asyncSleep(DelayBetweenInputs);
            robot.typeStringDelayed('alert (window?.location?.href)', CharPerMin);
            await asyncSleep(DelayBetweenInputs);
            robotKeyTaps(1, 'enter');

            const windowAlertDialog = await Promise.any(allWindowsDialogEventListener);

            const alertMsg = windowAlertDialog?.message();
            const devToolsPointsToIndexHtml = alertMsg.endsWith('index.html');
            devToolsPointsToIndexHtml.should.be.false;

            const devToolsPointsToCurrentServer = alertMsg.includes('localhost:8065');
            devToolsPointsToCurrentServer.should.be.true;
        });
    });
});
