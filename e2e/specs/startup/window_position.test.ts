// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {openSettingsWindow} from '../../helpers/settingsWindow';

type WindowBounds = {x: number; y: number; width: number; height: number};

async function getMainWindowState(app: ElectronApplication) {
    return app.evaluate(({BrowserWindow}) => {
        const refs = (global as any).__e2eTestRefs;
        const win = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
        if (!win) {
            throw new Error('Main window not found');
        }
        return {
            bounds: win.getBounds(),
            isFullScreen: win.isFullScreen(),
        };
    });
}

async function tileMainWindowToLeftHalf(app: ElectronApplication): Promise<WindowBounds> {
    return app.evaluate(({BrowserWindow, screen}) => {
        const refs = (global as any).__e2eTestRefs;
        const win = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
        if (!win) {
            throw new Error('Main window not found');
        }

        if (win.isFullScreen()) {
            win.setFullScreen(false);
        }

        const workArea = screen.getPrimaryDisplay().workArea;
        const bounds = {
            x: workArea.x,
            y: workArea.y,
            width: Math.floor(workArea.width / 2),
            height: workArea.height,
        };
        win.setBounds(bounds);
        return win.getBounds();
    });
}

async function enterMainWindowFullScreen(app: ElectronApplication): Promise<void> {
    await app.evaluate(async ({BrowserWindow}) => {
        const refs = (global as any).__e2eTestRefs;
        const win = refs?.MainWindow?.get?.() ?? BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
        if (!win) {
            throw new Error('Main window not found');
        }

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for fullscreen')), 20_000);
            if (win.isFullScreen()) {
                clearTimeout(timeout);
                resolve();
                return;
            }
            win.once('enter-full-screen', () => {
                clearTimeout(timeout);
                resolve();
            });
            win.setFullScreen(true);
        });
    });

    expect((await getMainWindowState(app)).isFullScreen).toBe(true);
}

async function exerciseWindowChrome(
    electronApp: ElectronApplication,
    mainWindow: Page,
    options: {openSettings?: boolean} = {},
) {
    const {openSettings = true} = options;
    await mainWindow.click('#newTabButton').catch(() => {});
    await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)', {timeout: 15_000}).catch(() => {});
    const secondTabExists = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
    if (secondTabExists) {
        await secondTabExists.click();
        await mainWindow.click('.TabBar li.serverTabItem:nth-child(1)').catch(() => {});
    }

    if (openSettings) {
        const settingsWindow = await openSettingsWindow(electronApp);
        await settingsWindow.click('#settingCategoryButton-general');
        await settingsWindow.evaluate(() => {
            const desktop = (window as Window & {desktop?: {modals?: {cancelModal?: () => void}}}).desktop;
            if (!desktop?.modals?.cancelModal) {
                throw new Error('desktop.modals.cancelModal is not available');
            }
            desktop.modals.cancelModal();
        });
        await settingsWindow.waitForEvent('close', {timeout: 10_000});
    }
}

test.describe('startup/window_position', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(180_000);

    test(
        'MM-T4049 Use app in tiled and full screen position',
        {tag: ['@P2', '@all']},
        async ({electronApp, mainWindow, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            expect(serverEntry?.win, 'Mattermost server view should exist').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(serverEntry!.win);
            await mainWindow.waitForSelector('#newTabButton', {timeout: 30_000});

            const tiledBounds = await tileMainWindowToLeftHalf(electronApp);
            await exerciseWindowChrome(electronApp, mainWindow);

            const afterTiled = await getMainWindowState(electronApp);
            expect(afterTiled.isFullScreen).toBe(false);
            expect(Math.abs(afterTiled.bounds.x - tiledBounds.x)).toBeLessThanOrEqual(5);
            expect(Math.abs(afterTiled.bounds.y - tiledBounds.y)).toBeLessThanOrEqual(5);
            expect(Math.abs(afterTiled.bounds.width - tiledBounds.width)).toBeLessThanOrEqual(10);
            expect(Math.abs(afterTiled.bounds.height - tiledBounds.height)).toBeLessThanOrEqual(10);

            await enterMainWindowFullScreen(electronApp);
            await exerciseWindowChrome(electronApp, mainWindow, {openSettings: false});

            const afterFullScreen = await getMainWindowState(electronApp);
            expect(afterFullScreen.isFullScreen, 'App must remain in full screen after tab and modal interactions').toBe(true);
        },
    );
});
