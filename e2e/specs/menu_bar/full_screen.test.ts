// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('menu/view', () => {
    test('MM-T816 Toggle Full Screen in the Menu Bar', {tag: ['@P2', '@win32']}, async ({electronApp, mainWindow}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);
        await firstServer.waitForSelector('#post_textbox');
        const currentWidth = await firstServer.evaluate('window.outerWidth');
        const currentHeight = await firstServer.evaluate('window.outerHeight');
        await mainWindow.click('button.three-dot-menu');
        await mainWindow.keyboard.press('v');
        await mainWindow.keyboard.press('t');
        await mainWindow.keyboard.press('Enter');

        await electronApp.evaluate(async ({BrowserWindow}) => {
            const win = BrowserWindow.getAllWindows()[0];
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timed out waiting for fullscreen')), 15000);
                const check = () => {
                    if (win.isFullScreen()) {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        });

        const fullScreenWidth = await firstServer.evaluate('window.outerWidth');
        const fullScreenHeight = await firstServer.evaluate('window.outerHeight');
        expect(fullScreenWidth).toBeGreaterThan(currentWidth as number);
        expect(fullScreenHeight).toBeGreaterThan(currentHeight as number);
        await mainWindow.click('button.three-dot-menu');
        await mainWindow.keyboard.press('v');
        await mainWindow.keyboard.press('t');
        await mainWindow.keyboard.press('Enter');

        await electronApp.evaluate(async ({BrowserWindow}) => {
            const win = BrowserWindow.getAllWindows()[0];
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timed out waiting for exit fullscreen')), 15000);
                const check = () => {
                    if (!win.isFullScreen()) {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        });

        const exitWidth = await firstServer.evaluate('window.outerWidth');
        const exitHeight = await firstServer.evaluate('window.outerHeight');
        expect(exitWidth).toBeLessThan(fullScreenWidth as number);
        expect(exitHeight).toBeLessThan(fullScreenHeight as number);
    });
});
