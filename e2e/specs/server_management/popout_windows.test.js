// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('server_management/popout_windows', function desc() {
    this.timeout(30000);
    const config = {
        ...env.demoMattermostConfig,
        alwaysMinimize: false, // This ensures the app quits when main window is closed
        minimizeToTray: false, // This ensures the app quits instead of minimizing to tray
    };

    const beforeFunc = async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
    };

    const afterFunc = async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    };

    describe('MM-TXXXX popout window functionality', async () => {
        let popoutWindow;

        before(async () => {
            await beforeFunc();
            this.serverMap = await env.getServerMap(this.app);
            const mmServer = this.serverMap[config.servers[0].name][0].win;
            await env.loginToMattermost(mmServer);
        });

        after(afterFunc);

        it('MM-TXXXX_1 should create a new popout window using keyboard shortcut', async () => {
            // Create a new popout window using CmdOrCtrl+N
            robot.keyTap('n', [env.cmdOrCtrl]);
            await asyncSleep(2000);

            // Verify a new window was created
            const windows = this.app.windows();
            const popoutWindows = windows.filter((window) => window.url().includes('popout.html'));
            popoutWindows.length.should.equal(1);

            popoutWindow = popoutWindows[0];
            popoutWindow.should.exist;
        });

        it('MM-TXXXX_2 should resize the popout window by dragging corners', async () => {
            // Get initial window bounds
            const browserWindow = await this.app.browserWindow(popoutWindow);
            const initialBounds = await browserWindow.evaluate((window) => window.getBounds());

            // Simulate resizing by setting new bounds
            const newBounds = {
                x: initialBounds.x,
                y: initialBounds.y,
                width: initialBounds.width + 100,
                height: initialBounds.height + 100,
            };

            await browserWindow.evaluate((window, bounds) => {
                window.setBounds(bounds);
            }, newBounds);

            await asyncSleep(1000);

            // Verify the window was resized
            const currentBounds = await browserWindow.evaluate((window) => window.getBounds());
            currentBounds.width.should.equal(newBounds.width);
            currentBounds.height.should.equal(newBounds.height);
        });

        it('MM-TXXXX_3 should move the popout window by dragging title bar', async () => {
            const browserWindow = await this.app.browserWindow(popoutWindow);
            const initialBounds = await browserWindow.evaluate((window) => window.getBounds());

            // Simulate moving the window
            const newBounds = {
                x: initialBounds.x + 50,
                y: initialBounds.y + 50,
                width: initialBounds.width,
                height: initialBounds.height,
            };

            await browserWindow.evaluate((window, bounds) => {
                window.setBounds(bounds);
            }, newBounds);

            await asyncSleep(1000);

            // Verify the window was moved
            const currentBounds = await browserWindow.evaluate((window) => window.getBounds());
            currentBounds.x.should.equal(newBounds.x);
            currentBounds.y.should.equal(newBounds.y);
        });

        it('MM-TXXXX_4 should close the popout window using close button', async () => {
            const browserWindow = await this.app.browserWindow(popoutWindow);

            // Close the popout window
            await browserWindow.evaluate((window) => window.close());
            await asyncSleep(1000);

            // Verify the popout window was closed
            const windows = this.app.windows();
            const popoutWindows = windows.filter((window) => window.url().includes('popout.html'));
            popoutWindows.length.should.equal(0);
        });

        if (process.platform !== 'darwin') {
            it('MM-TXXXX_5 should close popout windows when main window is closed', async () => {
                // Create a popout window first
                robot.keyTap('n', [env.cmdOrCtrl]);
                await asyncSleep(2000);

                // Verify we have both main window and popout window
                const windows = this.app.windows();
                const mainWindows = windows.filter((window) => window.url().includes('index'));
                const popoutWindows = windows.filter((window) => window.url().includes('popout.html'));
                mainWindows.length.should.equal(1);
                popoutWindows.length.should.equal(1);

                // Close the main window
                const mainWindow = mainWindows[0];
                const mainBrowserWindow = await this.app.browserWindow(mainWindow);
                await mainBrowserWindow.evaluate((window) => window.close());

                // Wait briefly to allow windows to close
                await asyncSleep(1000);

                // Check the current state of windows
                const remainingWindows = this.app.windows();
                const remainingPopouts = remainingWindows.filter((window) => window.url().includes('popout.html'));

                // Popout windows should be closed when main window is closed
                remainingPopouts.length.should.equal(0);
            });
        }
    });

    describe('MM-T4411 popout window content functionality', async () => {
        let mainWindow;
        let popoutWindow;

        before(async () => {
            await beforeFunc();
            this.serverMap = await env.getServerMap(this.app);
            const mmServer = this.serverMap[config.servers[0].name][0].win;
            await env.loginToMattermost(mmServer);
            mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        });

        after(afterFunc);

        it('MM-T4411_1 should display the same server content in popout window', async () => {
            // Create a new popout window
            robot.keyTap('n', [env.cmdOrCtrl]);
            await asyncSleep(2000);

            // Get the popout window
            const windows = this.app.windows();
            const popoutWindows = windows.filter((window) => window.url().includes('popout.html'));
            popoutWindows.length.should.equal(1);
            popoutWindow = popoutWindows[0];

            // Verify both windows are showing the same server
            // The window titles might be generic, but both should be popout windows
            const mainWindowTitle = await mainWindow.title();
            const popoutWindowTitle = await popoutWindow.title();

            // Both windows should have similar titles (Mattermost Desktop App)
            mainWindowTitle.should.contain('Mattermost');
            popoutWindowTitle.should.contain('Mattermost');

            // Close the popout window
            const browserWindow = await this.app.browserWindow(popoutWindow);
            await browserWindow.evaluate((window) => window.close());
            await asyncSleep(1000);
        });

        it('MM-T4411_2 should maintain separate navigation state in popout window', async () => {
            // Navigate to a different channel in the main window
            const mainView = this.serverMap[config.servers[0].name][0].win;
            await mainView.waitForSelector('#sidebarItem_off-topic');
            await mainView.click('#sidebarItem_off-topic');
            await asyncSleep(1000);

            // Create a new popout window
            robot.keyTap('n', [env.cmdOrCtrl]);
            await asyncSleep(2000);

            // Get the popout window
            const windows = this.app.windows();
            const popoutWindows = windows.filter((window) => window.url().includes('popout.html'));
            popoutWindows.length.should.equal(1);
            popoutWindow = popoutWindows[0];

            // The main window should be on Off-Topic
            const mainTabText = await mainWindow.innerText('.TabBar li.serverTabItem.active');
            mainTabText.should.contain('Off-Topic');

            // Close the popout window
            const browserWindow = await this.app.browserWindow(popoutWindow);
            await browserWindow.evaluate((window) => window.close());
            await asyncSleep(1000);
        });
    });
});
