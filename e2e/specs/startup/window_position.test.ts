// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {openSettingsWindow} from '../../helpers/settingsWindow';
import {evaluateInMainProcessWithArg} from '../../helpers/testRefs';

type WindowBounds = {x: number; y: number; width: number; height: number};

type MainWindowAction =
    | {type: 'getState'}
    | {type: 'tileLeft'}
    | {type: 'expand'}
    | {type: 'isExpanded'};

function hasLoginCredentials(): boolean {
    return Boolean(
        process.env.MM_TEST_SERVER_URL &&
        process.env.MM_TEST_USER_NAME &&
        process.env.MM_TEST_PASSWORD,
    );
}

async function evaluateMainWindow<T>(app: ElectronApplication, action: MainWindowAction): Promise<T> {
    return evaluateInMainProcessWithArg(app, (electron, act) => {
        const refs = (global as any).__e2eTestRefs;
        const win = refs?.MainWindow?.get?.() ??
            electron.BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
        if (!win) {
            throw new Error('Main window not found');
        }

        switch (act.type) {
        case 'getState':
            return {
                bounds: win.getBounds(),
                isFullScreen: win.isFullScreen(),
            } as T;
        case 'tileLeft': {
            if (win.isFullScreen()) {
                win.setFullScreen(false);
            }
            if (win.isMaximized()) {
                win.unmaximize();
            }

            const workArea = electron.screen.getPrimaryDisplay().workArea;
            const bounds = {
                x: workArea.x,
                y: workArea.y,
                width: Math.floor(workArea.width / 2),
                height: workArea.height,
            };
            win.setBounds(bounds);
            return win.getBounds() as T;
        }
        case 'expand':
            if (process.platform === 'linux') {
                if (win.isMaximized()) {
                    win.unmaximize();
                }
                win.setBounds(electron.screen.getPrimaryDisplay().workArea);
            } else {
                win.setFullScreen(true);
            }
            return undefined as T;
        case 'isExpanded':
            if (process.platform === 'linux') {
                const workArea = electron.screen.getPrimaryDisplay().workArea;
                const bounds = win.getBounds();
                return (
                    Math.abs(bounds.x - workArea.x) <= 5 &&
                    Math.abs(bounds.y - workArea.y) <= 5 &&
                    Math.abs(bounds.width - workArea.width) <= 10 &&
                    Math.abs(bounds.height - workArea.height) <= 10
                ) as T;
            }
            return Boolean(win.isFullScreen()) as T;
        default:
            throw new Error(`Unsupported main window action: ${(act as MainWindowAction).type}`);
        }
    }, action);
}

async function getMainWindowState(app: ElectronApplication) {
    return evaluateMainWindow<{bounds: WindowBounds; isFullScreen: boolean}>(app, {type: 'getState'});
}

async function tileMainWindowToLeftHalf(app: ElectronApplication): Promise<WindowBounds> {
    return evaluateMainWindow<WindowBounds>(app, {type: 'tileLeft'});
}

async function getPrimaryWorkArea(app: ElectronApplication): Promise<WindowBounds> {
    return app.evaluate(({screen}) => {
        const {x, y, width, height} = screen.getPrimaryDisplay().workArea;
        return {x, y, width, height};
    });
}

async function boundsMatchWorkArea(bounds: WindowBounds, workArea: WindowBounds): Promise<boolean> {
    return (
        Math.abs(bounds.x - workArea.x) <= 5 &&
        Math.abs(bounds.y - workArea.y) <= 5 &&
        Math.abs(bounds.width - workArea.width) <= 10 &&
        Math.abs(bounds.height - workArea.height) <= 10
    );
}

async function enterMainWindowExpanded(app: ElectronApplication): Promise<void> {
    await evaluateMainWindow(app, {type: 'expand'});

    await expect.poll(
        () => isMainWindowExpanded(app),
        {
            timeout: 20_000,
            message: process.platform === 'linux' ?
                'Main window must expand to the display work area on Linux' :
                'Main window must enter full screen',
        },
    ).toBe(true);
}

async function isMainWindowExpanded(app: ElectronApplication): Promise<boolean> {
    if (process.platform === 'linux') {
        const [state, workArea] = await Promise.all([
            getMainWindowState(app),
            getPrimaryWorkArea(app),
        ]);
        return boundsMatchWorkArea(state.bounds, workArea);
    }

    return evaluateMainWindow<boolean>(app, {type: 'isExpanded'});
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
        // Open + cancelModal exercises settings chrome while tiled/fullscreen.
        // Avoid clicking category buttons here: on Linux CI, after parent tiling the
        // settings WebContentsView can tear down mid-click ("Target page ... closed").
        // focus.test uses the same cancelModal close path successfully.
        const settingsWindow = await openSettingsWindow(electronApp);
        await settingsWindow.waitForSelector('.SettingsModal', {timeout: 15_000});
        if (process.platform === 'linux') {
            // ModalView defers setBounds by 10ms on Linux; wait for the view to settle
            // after the parent was tiled before touching the page.
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
        if (settingsWindow.isClosed()) {
            throw new Error('Settings window closed before cancelModal could run');
        }
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
            if (!hasLoginCredentials()) {
                test.skip(true, 'MM_TEST_SERVER_URL, MM_TEST_USER_NAME, and MM_TEST_PASSWORD required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            expect(serverEntry?.win, 'Mattermost server view should exist').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(serverEntry!.win);
            await mainWindow.waitForSelector('#newTabButton', {timeout: 30_000});

            const tiledBounds = await tileMainWindowToLeftHalf(electronApp);
            // Let MAIN_WINDOW_RESIZED / modal bound handlers settle before opening settings.
            await new Promise((resolve) => setTimeout(resolve, 300));
            await exerciseWindowChrome(electronApp, mainWindow);

            const afterTiled = await getMainWindowState(electronApp);
            expect(afterTiled.isFullScreen).toBe(false);
            expect(await isMainWindowExpanded(electronApp)).toBe(false);
            expect(Math.abs(afterTiled.bounds.x - tiledBounds.x)).toBeLessThanOrEqual(5);
            expect(Math.abs(afterTiled.bounds.y - tiledBounds.y)).toBeLessThanOrEqual(5);
            expect(Math.abs(afterTiled.bounds.width - tiledBounds.width)).toBeLessThanOrEqual(10);
            expect(Math.abs(afterTiled.bounds.height - tiledBounds.height)).toBeLessThanOrEqual(10);

            await enterMainWindowExpanded(electronApp);
            await exerciseWindowChrome(electronApp, mainWindow, {openSettings: false});

            expect(
                await isMainWindowExpanded(electronApp),
                process.platform === 'linux' ?
                    'App must remain expanded to the display work area after tab interactions on Linux' :
                    'App must remain in full screen after tab and modal interactions',
            ).toBe(true);
        },
    );
});
