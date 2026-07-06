// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {clickApplicationMenuItem} from '../../helpers/menu';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {openSettingsWindow} from '../../helpers/settingsWindow';
import {evaluateInMainProcessWithArg, getActiveServerWebContentsId} from '../../helpers/testRefs';

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
    await app.evaluate(({app: electronApp, BrowserWindow}) => {
        const viewMenu = electronApp.applicationMenu?.getMenuItemById('view');
        const toggleItem = viewMenu?.submenu?.items?.find(
            (item) => item.role === 'togglefullscreen' || item.accelerator === 'F11',
        );
        if (!toggleItem) {
            throw new Error('Toggle Full Screen menu item not found');
        }

        const refs = (global as any).__e2eTestRefs;
        const targetWindow = BrowserWindow.getFocusedWindow() ??
            refs?.MainWindow?.get?.() ??
            BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed()) ??
            null;
        toggleItem.click(undefined, targetWindow, undefined);
    });

    await expect.poll(async () => (await getMainWindowState(app)).isFullScreen, {
        timeout: 15_000,
        message: 'Main window must enter full screen',
    }).toBe(true);
}

async function exerciseWindowChrome(electronApp: ElectronApplication, mainWindow: Page) {
    await mainWindow.click('#newTabButton').catch(() => {});
    await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)', {timeout: 15_000}).catch(() => {});
    const secondTabExists = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
    if (secondTabExists) {
        await secondTabExists.click();
        await mainWindow.click('.TabBar li.serverTabItem:nth-child(1)').catch(() => {});
    }

    const settingsWindow = await openSettingsWindow(electronApp);
    await settingsWindow.click('#settingCategoryButton-general').catch(() => {});
    await settingsWindow.keyboard.press('Escape').catch(() => {});
    await settingsWindow.close().catch(() => {});

    const webContentsId = await getActiveServerWebContentsId(electronApp);
    await clickApplicationMenuItem(
        electronApp,
        'view',
        {label: 'Developer Tools for Current Tab'},
        {webContentsId},
    );
    await expect.poll(
        () => evaluateInMainProcessWithArg(electronApp, ({webContents}, id) => {
            const wc = webContents.fromId(id);
            return Boolean(wc && !wc.isDestroyed() && wc.isDevToolsOpened());
        }, webContentsId),
        {timeout: 15_000, message: 'Developer Tools must open for the current server tab'},
    ).toBe(true);

    await clickApplicationMenuItem(
        electronApp,
        'view',
        {label: 'Developer Tools for Current Tab'},
        {webContentsId},
    );
    await expect.poll(
        () => evaluateInMainProcessWithArg(electronApp, ({webContents}, id) => {
            const wc = webContents.fromId(id);
            return Boolean(wc && !wc.isDestroyed() && !wc.isDevToolsOpened());
        }, webContentsId),
        {timeout: 15_000, message: 'Developer Tools must close for the current server tab'},
    ).toBe(true);
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
            await exerciseWindowChrome(electronApp, mainWindow);

            const afterFullScreen = await getMainWindowState(electronApp);
            expect(afterFullScreen.isFullScreen, 'App must remain in full screen after tab and modal interactions').toBe(true);
        },
    );
});
