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

function getZoomFactorOfServer(browserWindow, serverId) {
    return browserWindow.evaluate(
        (window, id) => window.getBrowserViews().find((view) => view.webContents.id === id).webContents.getZoomFactor(),
        serverId,
    );
}
function setZoomFactorOfServer(browserWindow, serverId, zoomFactor) {
    return browserWindow.evaluate(
        (window, {id, zoom}) => window.getBrowserViews().find((view) => view.webContents.id === id).webContents.setZoomFactor(zoom),
        {id: serverId, zoom: zoomFactor},
    );
}

describe('menu/view', function desc() {
    this.timeout(30000);

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
        await asyncSleep(1000);
        robot.keyTap('f', [process.platform === 'darwin' ? 'command' : 'control']);
        await asyncSleep(500);
        const isFocused = await firstServer.$eval('#searchBox', (el) => el === document.activeElement);
        isFocused.should.be.true;
        const text = await firstServer.inputValue('#searchBox');
        text.should.include('in:');
    });

    // TODO: No keyboard shortcut for macOS
    if (process.platform !== 'darwin') {
        it('MM-T816 Toggle Full Screen in the Menu Bar', async () => {
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
        });
    }

    it('MM-T817 Actual Size Zoom in the menu bar', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const browserWindow = await this.app.browserWindow(mainWindow);
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        const firstServerId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#searchBox');

        robot.keyTap('=', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        let zoomLevel = await browserWindow.evaluate((window, id) => window.getBrowserViews().find((view) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
        zoomLevel.should.be.greaterThan(1);

        robot.keyTap('0', [env.cmdOrCtrl]);
        await asyncSleep(1000);
        zoomLevel = await browserWindow.evaluate((window, id) => window.getBrowserViews().find((view) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
        zoomLevel.should.be.equal(1);
    });

    describe('MM-T818 Zoom in from the menu bar', () => {
        it('MM-T818 Zoom in when CmdOrCtrl+Plus is pressed', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            const firstServerId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchBox');

            robot.keyTap('=', [env.cmdOrCtrl]);
            await asyncSleep(1000);
            const zoomLevel = await browserWindow.evaluate((window, id) => window.getBrowserViews().find((view) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
            zoomLevel.should.be.greaterThan(1);
        });

        it('MM-T818_1 Zoom in when CmdOrCtrl+Shift+Plus is pressed', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            const firstServerId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchBox');

            // reset zoom
            await setZoomFactorOfServer(browserWindow, firstServerId, 1);
            await asyncSleep(1000);
            const initialZoom = await getZoomFactorOfServer(browserWindow, firstServerId);
            initialZoom.should.be.equal(1);

            robot.keyTap('=', [env.cmdOrCtrl, 'shift']);
            await asyncSleep(1000);
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            zoomLevel.should.be.greaterThan(1);
        });
    });

    describe('MM-T818 Zoom out from the menu bar', () => {
        it('MM-T819 Zoom out when CmdOrCtrl+Minus is pressed', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            const firstServerId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchBox');

            robot.keyTap('-', [env.cmdOrCtrl]);
            await asyncSleep(1000);
            const zoomLevel = await browserWindow.evaluate((window, id) => window.getBrowserViews().find((view) => view.webContents.id === id).webContents.getZoomFactor(), firstServerId);
            zoomLevel.should.be.lessThan(1);
        });

        it('MM-44931 Zoom out when CmdOrCtrl+Shift+Minus is pressed', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            const firstServerId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#searchBox');

            // reset zoom
            await setZoomFactorOfServer(browserWindow, firstServerId, 1.0);
            await asyncSleep(1000);
            const initialZoom = await getZoomFactorOfServer(browserWindow, firstServerId);
            initialZoom.should.be.equal(1);

            robot.keyTap('-', [env.cmdOrCtrl, 'shift']);
            await asyncSleep(1000);
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            zoomLevel.should.be.lessThan(1);
        });
    });

    describe('Reload', () => {
        let browserWindow;
        let webContentsId;

        beforeEach(async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            browserWindow = await this.app.browserWindow(mainWindow);
            webContentsId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;

            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        });

        it('MM-T814 should reload page when pressing Ctrl+R', async () => {
            const check = browserWindow.evaluate(setupPromise, webContentsId);
            await asyncSleep(500);
            robot.keyTap('r', [env.cmdOrCtrl]);
            const result = await check;
            result.should.be.true;
        });

        it('MM-T815 should reload page when pressing Ctrl+Shift+R', async () => {
            const check = browserWindow.evaluate(setupPromise, webContentsId);
            await asyncSleep(500);
            robot.keyTap('r', [env.cmdOrCtrl, 'shift']);
            const result = await check;
            result.should.be.true;
        });
    });

    it('MM-T820 should open Developer Tools For Application Wrapper for main window', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        const browserWindow = await this.app.browserWindow(mainWindow);
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});

        let isDevToolsOpen = await browserWindow.evaluate((window) => {
            return window.webContents.isDevToolsOpened();
        });
        isDevToolsOpen.should.be.false;

        robot.keyTap('i', process.platform === 'darwin' ? ['command', 'alt'] : ['control', 'shift']);
        await asyncSleep(1000);

        isDevToolsOpen = await browserWindow.evaluate((window) => {
            return window.webContents.isDevToolsOpened();
        });
        isDevToolsOpen.should.be.true;
    });

    // TODO: Missing shortcut for macOS
    if (process.platform !== 'darwin') {
        it('MM-T821 should open Developer Tools For Current Server for the active tab', async () => {
            const mainWindow = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            const browserWindow = await this.app.browserWindow(mainWindow);
            const webContentsId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});

            let isDevToolsOpen = await browserWindow.evaluate((window, id) => {
                return window.getBrowserViews().find((view) => view.webContents.id === id).webContents.isDevToolsOpened();
            }, webContentsId);
            isDevToolsOpen.should.be.false;

            // Open Developer Tools for Current Server
            robot.keyTap('alt');
            robot.keyTap('enter');
            robot.keyTap('v');
            robot.keyTap('d');
            robot.keyTap('d');
            robot.keyTap('enter');
            await asyncSleep(1000);

            isDevToolsOpen = await browserWindow.evaluate((window, id) => {
                return window.getBrowserViews().find((view) => view.webContents.id === id).webContents.isDevToolsOpened();
            }, webContentsId);
            isDevToolsOpen.should.be.true;
        });
    }
});
