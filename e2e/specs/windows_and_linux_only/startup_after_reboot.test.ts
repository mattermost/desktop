// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {closeElectronApp} from '../../helpers/electronApp';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';
import {ensureAutostartEnabled, waitForConfigValue} from '../../helpers/settingsConfig';
import {openSettingsWindow} from '../../helpers/settingsWindow';

test.describe('windows_and_linux_only/startup_after_reboot', () => {
    test(
        'MM-T1574 Startup after reboot loads properly — Windows & Linux ONLY',
        {tag: ['@P2', '@win32', '@linux']},
        async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'reboot-userdata');
            fs.mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, {
                ...demoMattermostConfig,
                autostart: false,
            });

            const launchApp = async () => {
                return electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                    env: {...process.env, NODE_ENV: 'test'},
                    timeout: 90_000,
                });
            };

            const firstApp = await launchApp();
            try {
                await waitForAppReady(firstApp);

                const settingsWindow = await openSettingsWindow(firstApp);
                await settingsWindow.click('#settingCategoryButton-general');

                const configPath = path.join(userDataDir, 'config.json');
                await ensureAutostartEnabled(settingsWindow, configPath);
                await waitForConfigValue(configPath, 'autostart', true);

                await settingsWindow.close().catch(() => {});

                if (process.env.MM_TEST_SERVER_URL) {
                    const serverMap = await buildServerMap(firstApp);
                    const serverWin = serverMap.example?.[0]?.win;
                    expect(serverWin).toBeDefined();
                    await loginToMattermost(serverWin!);
                    await serverWin!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
                }
            } finally {
                await closeElectronApp(firstApp, userDataDir);
            }

            const relaunchedApp = await launchApp();
            try {
                await waitForAppReady(relaunchedApp);

                await expect.poll(async () => {
                    return relaunchedApp.evaluate(({BrowserWindow}) => {
                        const win = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
                        return Boolean(win && win.isVisible());
                    });
                }, {timeout: 15_000, message: 'Desktop app must show a visible main window after relaunch'}).toBe(true);

                const hasBlankMainWindow = await relaunchedApp.evaluate(({BrowserWindow}) => {
                    const win = BrowserWindow.getAllWindows().find((candidate) => {
                        return !candidate.isDestroyed() && candidate.webContents.getURL().includes('index');
                    });
                    if (!win) {
                        return true;
                    }
                    const bounds = win.getBounds();
                    return bounds.width < 100 || bounds.height < 100;
                });
                expect(hasBlankMainWindow, 'Main window must not remain a white-screen-sized shell').toBe(false);

                if (process.env.MM_TEST_SERVER_URL) {
                    const serverMap = await buildServerMap(relaunchedApp);
                    const serverWin = serverMap.example?.[0]?.win;
                    expect(serverWin).toBeDefined();

                    const loginVisible = await serverWin!.locator('#input_loginId').isVisible().catch(() => false);
                    expect(loginVisible, 'Session should persist across relaunch when a server was configured').toBe(false);
                    await serverWin!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
                }
            } finally {
                await closeElectronApp(relaunchedApp, userDataDir);
            }
        },
    );
});
