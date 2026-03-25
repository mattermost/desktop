// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';

import {test, expect} from '../fixtures/index';

const SHOW_SETTINGS_WINDOW = 'show-settings-window';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

async function openSettingsWindow(electronApp: ElectronApplication) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const existingWindow = electronApp.windows().find((window) => window.url().includes('settings'));
        if (existingWindow) {
            await existingWindow.waitForLoadState().catch(() => {});
            return existingWindow;
        }

        try {
            await electronApp.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed') || attempt === 4) {
                throw error;
            }
        }

        try {
            const settingsWindow = electronApp.windows().find((window) => window.url().includes('settings')) ??
                await electronApp.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                    timeout: 3_000,
                });

            await settingsWindow.waitForLoadState().catch(() => {});
            return settingsWindow;
        } catch (error) {
            if (attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw new Error('Settings window did not open');
}

test.describe('Settings', () => {
    test.describe('Options', () => {
        test.describe('Start app on login', () => {
            test('MM-T4392 should appear on win32 or linux', {tag: ['@P2', '@all']}, async ({electronApp}) => {
                const expected = (process.platform === 'win32' || process.platform === 'linux');
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-general');
                await settingsWindow.click('#settingCategoryButton-general');
                await settingsWindow.waitForSelector('#CheckSetting_autostart', {state: expected ? 'attached' : 'detached'});
                const existing = await settingsWindow.isVisible('#CheckSetting_autostart');
                expect(existing).toBe(expected);
            });
        });

        test.describe('Show icon in menu bar / notification area', () => {
            test('MM-T4393_1 should appear on darwin or linux', {tag: ['@P2', '@all']}, async ({electronApp}) => {
                const expected = (process.platform === 'darwin' || process.platform === 'linux');
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-general');
                await settingsWindow.click('#settingCategoryButton-general');
                await settingsWindow.waitForSelector('#CheckSetting_showTrayIcon', {state: expected ? 'attached' : 'detached'});
                const existing = await settingsWindow.isVisible('#CheckSetting_showTrayIcon');
                expect(existing).toBe(expected);
            });

            test.describe('Save tray icon setting on mac', () => {
                test("MM-T4393_2 should be saved when it's selected", {tag: ['@P2', '@all']}, async ({electronApp}, testInfo) => {
                    if (!['darwin', 'linux'].includes(process.platform)) {
                        test.skip(true, 'darwin/linux only');
                        return;
                    }
                    const settingsWindow = await openSettingsWindow(electronApp);
                    await settingsWindow.waitForSelector('#settingCategoryButton-general');
                    await settingsWindow.click('#settingCategoryButton-general');
                    await settingsWindow.click('#CheckSetting_showTrayIcon button');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                    const configFilePath = `${testInfo.outputDir}/userdata/config.json`;
                    let config0 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                    expect(config0.showTrayIcon).toBe(true);

                    await settingsWindow.click('#CheckSetting_showTrayIcon button');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                    config0 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                    expect(config0.showTrayIcon).toBe(false);
                });
            });

            test.describe('Save tray icon theme on linux', () => {
                test("MM-T4393_3 should be saved when it's selected", {tag: ['@P2', '@all']}, async ({electronApp}, testInfo) => {
                    if (process.platform !== 'linux') {
                        test.skip(true, 'Linux only');
                        return;
                    }
                    const settingsWindow = await openSettingsWindow(electronApp);
                    await settingsWindow.waitForSelector('#settingCategoryButton-general');
                    await settingsWindow.click('#settingCategoryButton-general');
                    await settingsWindow.click('#CheckSetting_showTrayIcon button');
                    await settingsWindow.click('#RadioSetting_trayIconTheme_dark');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                    const configFilePath = `${testInfo.outputDir}/userdata/config.json`;
                    const config0 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                    expect(config0.trayIconTheme).toBe('dark');

                    await settingsWindow.waitForSelector('.SettingsModal__saving', {state: 'detached'});
                    await settingsWindow.click('#RadioSetting_trayIconTheme_light');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                    await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                    const config1 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                    expect(config1.trayIconTheme).toBe('light');
                });
            });
        });

        test.describe('Leave app running in notification area when application window is closed', () => {
            test('MM-T4394 should appear on linux and win32', {tag: ['@P2', '@all']}, async ({electronApp}) => {
                const expected = (process.platform === 'linux' || process.platform === 'win32');
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-general');
                await settingsWindow.click('#settingCategoryButton-general');
                const existing = await settingsWindow.isVisible('#CheckSetting_minimizeToTray');
                expect(existing).toBe(expected);
            });
        });

        test.describe('Flash app window and taskbar icon when a new message is received', () => {
            test('MM-T4395 should appear on win32 and linux', {tag: ['@P2', '@all']}, async ({electronApp}) => {
                const expected = (process.platform === 'win32' || process.platform === 'linux');
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-notifications');
                await settingsWindow.click('#settingCategoryButton-notifications');
                const existing = await settingsWindow.isVisible('#CheckSetting_flashWindow');
                expect(existing).toBe(expected);
            });
        });

        test.describe('Show red badge on taskbar icon to indicate unread messages', () => {
            test('MM-T4396 should appear on darwin or win32', {tag: ['@P2', '@all']}, async ({electronApp}) => {
                const expected = (process.platform === 'darwin' || process.platform === 'win32');
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-notifications');
                await settingsWindow.click('#settingCategoryButton-notifications');
                const existing = await settingsWindow.isVisible('#CheckSetting_showUnreadBadge');
                expect(existing).toBe(expected);
            });
        });

        test.describe('Check spelling', () => {
            test('MM-T4397 should appear and be selectable', {tag: ['@P2', '@all']}, async ({electronApp}, testInfo) => {
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-language');
                await settingsWindow.click('#settingCategoryButton-language');
                const existing = await settingsWindow.isVisible('#CheckSetting_useSpellChecker');
                expect(existing).toBe(true);

                const selected = await settingsWindow.isChecked('#checkSetting-useSpellChecker');
                expect(selected).toBe(true);

                await settingsWindow.click('#CheckSetting_useSpellChecker button');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                const configFilePath = `${testInfo.outputDir}/userdata/config.json`;
                const config1 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                expect(config1.useSpellChecker).toBe(false);
            });
        });

        test.describe('Enable GPU hardware acceleration', () => {
            test('MM-T4398 should save selected option', {tag: ['@P2', '@all']}, async ({electronApp}, testInfo) => {
                const ID_INPUT_ENABLE_HARDWARE_ACCELERATION = '#CheckSetting_enableHardwareAcceleration button';
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-advanced');
                await settingsWindow.click('#settingCategoryButton-advanced');
                const selected = await settingsWindow.isChecked('#checkSetting-enableHardwareAcceleration');
                expect(selected).toBe(true); // default is true

                await settingsWindow.click(ID_INPUT_ENABLE_HARDWARE_ACCELERATION);
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                const configFilePath = `${testInfo.outputDir}/userdata/config.json`;
                const config0 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                expect(config0.enableHardwareAcceleration).toBe(false);

                await settingsWindow.click(ID_INPUT_ENABLE_HARDWARE_ACCELERATION);
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');
                const config1 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                expect(config1.enableHardwareAcceleration).toBe(true);
            });
        });

        test.describe('Enable automatic check for updates', () => {
            test('MM-T4549 should save selected option', {tag: ['@P2', '@all']}, async ({electronApp}, testInfo) => {
                if (process.platform === 'darwin') {
                    test.skip(true, 'Not applicable on macOS');
                    return;
                }
                const ID_INPUT_ENABLE_AUTO_UPDATES = '#CheckSetting_autoCheckForUpdates button';
                const settingsWindow = await openSettingsWindow(electronApp);
                await settingsWindow.waitForSelector('#settingCategoryButton-general');
                await settingsWindow.click('#settingCategoryButton-general');
                const selected = await settingsWindow.isChecked('#checkSetting-autoCheckForUpdates');
                expect(selected).toBe(true); // default is true

                await settingsWindow.click(ID_INPUT_ENABLE_AUTO_UPDATES);
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                const configFilePath = `${testInfo.outputDir}/userdata/config.json`;
                const config0 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                expect(config0.autoCheckForUpdates).toBe(false);

                await settingsWindow.click(ID_INPUT_ENABLE_AUTO_UPDATES);
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Saving...")');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');
                const config1 = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                expect(config1.autoCheckForUpdates).toBe(true);
            });
        });
    });
});
