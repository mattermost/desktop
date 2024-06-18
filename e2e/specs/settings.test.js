// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const fs = require('fs');

const {SHOW_SETTINGS_WINDOW} = require('src/common/communication');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('Settings', function desc() {
    this.timeout(30000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        fs.writeFileSync(env.appUpdatePath, '');
        await asyncSleep(1000);
        this.app = await env.getApp();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    describe('Options', () => {
        describe('Start app on login', () => {
            it('MM-T4392 should appear on win32 or linux', async () => {
                const expected = (process.platform === 'win32' || process.platform === 'linux');
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                await settingsWindow.waitForSelector('#inputAutoStart', {state: expected ? 'attached' : 'detached'});
                const existing = await settingsWindow.isVisible('#inputAutoStart');
                existing.should.equal(expected);
            });
        });

        describe('Show icon in menu bar / notification area', () => {
            it('MM-T4393_1 should appear on darwin or linux', async () => {
                const expected = (process.platform === 'darwin' || process.platform === 'linux');
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                await settingsWindow.waitForSelector('#inputShowTrayIcon', {state: expected ? 'attached' : 'detached'});
                const existing = await settingsWindow.isVisible('#inputShowTrayIcon');
                existing.should.equal(expected);
            });

            describe('Save tray icon setting on mac', () => {
                env.shouldTest(it, env.isOneOf(['darwin', 'linux']))('MM-T4393_2 should be saved when it\'s selected', async () => {
                    this.app.evaluate(({ipcMain}, showWindow) => {
                        ipcMain.emit(showWindow);
                    }, SHOW_SETTINGS_WINDOW);
                    const settingsWindow = await this.app.waitForEvent('window', {
                        predicate: (window) => window.url().includes('settings'),
                    });
                    await settingsWindow.waitForSelector('.settingsPage.container');
                    await settingsWindow.click('#inputShowTrayIcon');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saving...")');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saved")');

                    let config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                    config0.showTrayIcon.should.true;

                    await settingsWindow.click('#inputShowTrayIcon');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saving...")');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saved")');

                    config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                    config0.showTrayIcon.should.false;
                });
            });

            describe('Save tray icon theme on linux', () => {
                env.shouldTest(it, process.platform === 'linux')('MM-T4393_3 should be saved when it\'s selected', async () => {
                    this.app.evaluate(({ipcMain}, showWindow) => {
                        ipcMain.emit(showWindow);
                    }, SHOW_SETTINGS_WINDOW);
                    const settingsWindow = await this.app.waitForEvent('window', {
                        predicate: (window) => window.url().includes('settings'),
                    });
                    await settingsWindow.waitForSelector('.settingsPage.container');
                    await settingsWindow.click('#inputShowTrayIcon');
                    await settingsWindow.click('input[value="dark"]');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saving...")');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saved")');

                    const config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                    config0.trayIconTheme.should.equal('dark');

                    await settingsWindow.click('input[value="light"]');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saving...")');
                    await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saved")');

                    const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                    config1.trayIconTheme.should.equal('light');
                });
            });
        });

        describe('Leave app running in notification area when application window is closed', () => {
            it('MM-T4394 should appear on linux and win32', async () => {
                const expected = (process.platform === 'linux' || process.platform === 'win32');
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                const existing = await settingsWindow.isVisible('#inputMinimizeToTray');
                existing.should.equal(expected);
            });
        });

        describe('Flash app window and taskbar icon when a new message is received', () => {
            it('MM-T4395 should appear on win32 and linux', async () => {
                const expected = (process.platform === 'win32' || process.platform === 'linux');
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                const existing = await settingsWindow.isVisible('#inputflashWindow');
                existing.should.equal(expected);
            });
        });

        describe('Show red badge on taskbar icon to indicate unread messages', () => {
            it('MM-T4396 should appear on darwin or win32', async () => {
                const expected = (process.platform === 'darwin' || process.platform === 'win32');
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                const existing = await settingsWindow.isVisible('#inputShowUnreadBadge');
                existing.should.equal(expected);
            });
        });

        describe('Check spelling', () => {
            it('MM-T4397 should appear and be selectable', async () => {
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                const existing = await settingsWindow.isVisible('#inputSpellChecker');
                existing.should.equal(true);

                const selected = await settingsWindow.isChecked('#inputSpellChecker');
                selected.should.equal(true);

                await settingsWindow.click('#inputSpellChecker');
                await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saving...")');
                await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saved")');

                const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                config1.useSpellChecker.should.equal(false);
            });
        });

        describe('Enable GPU hardware acceleration', () => {
            it('MM-T4398 should save selected option', async () => {
                const ID_INPUT_ENABLE_HARDWARE_ACCELERATION = '#inputEnableHardwareAcceleration';
                this.app.evaluate(({ipcMain}, showWindow) => {
                    ipcMain.emit(showWindow);
                }, SHOW_SETTINGS_WINDOW);
                const settingsWindow = await this.app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                });
                await settingsWindow.waitForSelector('.settingsPage.container');
                const selected = await settingsWindow.isChecked(ID_INPUT_ENABLE_HARDWARE_ACCELERATION);
                selected.should.equal(true); // default is true

                await settingsWindow.click(ID_INPUT_ENABLE_HARDWARE_ACCELERATION);
                await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saving...")');
                await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saved")');
                const config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                config0.enableHardwareAcceleration.should.equal(false);

                await settingsWindow.click(ID_INPUT_ENABLE_HARDWARE_ACCELERATION);
                await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saving...")');
                await settingsWindow.waitForSelector('.appOptionsSaveIndicator :text("Saved")');
                const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                config1.enableHardwareAcceleration.should.equal(true);
            });
        });

        if (process.platform !== 'darwin') {
            describe('Enable automatic check for updates', () => {
                it('MM-T4549 should save selected option', async () => {
                    const ID_INPUT_ENABLE_AUTO_UPDATES = '#inputAutoCheckForUpdates';
                    this.app.evaluate(({ipcMain}, showWindow) => {
                        ipcMain.emit(showWindow);
                    }, SHOW_SETTINGS_WINDOW);
                    const settingsWindow = await this.app.waitForEvent('window', {
                        predicate: (window) => window.url().includes('settings'),
                    });
                    await settingsWindow.waitForSelector('.settingsPage.container');
                    const selected = await settingsWindow.isChecked(ID_INPUT_ENABLE_AUTO_UPDATES);
                    selected.should.equal(true); // default is true

                    await settingsWindow.click(ID_INPUT_ENABLE_AUTO_UPDATES);
                    await settingsWindow.waitForSelector('.updatesSaveIndicator :text("Saving...")');
                    await settingsWindow.waitForSelector('.updatesSaveIndicator :text("Saved")');
                    const config0 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                    config0.autoCheckForUpdates.should.equal(false);

                    await settingsWindow.click(ID_INPUT_ENABLE_AUTO_UPDATES);
                    await settingsWindow.waitForSelector('.updatesSaveIndicator :text("Saving...")');
                    await settingsWindow.waitForSelector('.updatesSaveIndicator :text("Saved")');
                    const config1 = JSON.parse(fs.readFileSync(env.configFilePath, 'utf-8'));
                    config1.autoCheckForUpdates.should.equal(true);
                });
            });
        }
    });
});
