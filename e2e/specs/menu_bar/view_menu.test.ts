// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {waitForWindow, closeElectronAppFast} from '../../helpers/electronApp';
import {loginToMattermost} from '../../helpers/login';
import {closeDownloadsDropdownIfOpen} from '../../helpers/downloadsDropdown';
import {clickApplicationMenuItem} from '../../helpers/menu';
import {
    activateServerView,
    openServerSearch,
    SEARCH_INPUT,
    waitForSearchBarFocused,
} from '../../helpers/serverContext';
import {buildServerMap} from '../../helpers/serverMap';
import {evaluateInMainProcessWithArg} from '../../helpers/testRefs';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;
type ElectronPage = import('playwright').Page;

let electronApp: ElectronApplication | undefined;
let mainWindow: ElectronPage;
let userDataDir: string;

function getZoomFactorOfServer(browserWindow: any, serverId: number) {
    return browserWindow.evaluate(
        (window: any, id: number) => window.contentView.children.find((view: any) => view.webContents.id === id).webContents.getZoomFactor(),
        serverId,
    );
}

function setZoomFactorOfServer(browserWindow: any, serverId: number, zoomFactor: number) {
    return browserWindow.evaluate(
        (window: any, {id, zoom}: {id: number; zoom: number}) => window.contentView.children.find((view: any) => view.webContents.id === id).webContents.setZoomFactor(zoom),
        {id: serverId, zoom: zoomFactor},
    );
}

/**
 * Find and click a view-menu zoom item by its accelerator string.
 * More reliable than matching on `.role` or `.visible` which Electron may
 * normalise differently at runtime.
 */
async function clickViewMenuItemByAccelerator(
    electronApp: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>,
    webContentsId: number,
    accelerator: string,
) {
    await clickApplicationMenuItem(
        electronApp,
        'view',
        {accelerator},
        {webContentsId},
    );
}

async function waitForServerReload(
    electronApp: Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>,
    webContentsId: number,
    trigger: () => Promise<void>,
) {
    await activateServerView(electronApp, webContentsId);
    await closeDownloadsDropdownIfOpen(electronApp);

    const serverMap = await buildServerMap(electronApp);
    const serverWin = serverMap[demoMattermostConfig.servers[0].name][0].win;

    await evaluateInMainProcessWithArg(
        electronApp,
        ({webContents}, id) => {
            const refs = (global as any).__e2eTestRefs;
            const mmView = refs?.WebContentsManager.getViewByWebContentsId(id);
            const wc = webContents.fromId(id);
            if (!mmView || !wc || wc.isDestroyed()) {
                throw new Error(`No server view registered for webContentsId ${id}`);
            }

            const previous = (global as any).__e2eReloadWatchers?.[id];
            if (previous) {
                mmView.off('reload_view', previous.onReload);
                wc.removeListener('did-finish-load', previous.onFinishLoad);
            }

            (global as any).__e2eReloadWatchers ??= {};
            (global as any).__e2eReloadWatchers[id] = {
                detected: false,
                onReload: () => {
                    (global as any).__e2eReloadWatchers[id].detected = true;
                },
                onFinishLoad: () => {
                    (global as any).__e2eReloadWatchers[id].detected = true;
                },
            };

            const watcher = (global as any).__e2eReloadWatchers[id];
            mmView.on('reload_view', watcher.onReload);
            wc.on('did-finish-load', watcher.onFinishLoad);
            return true;
        },
        webContentsId,
    );

    await activateServerView(electronApp, webContentsId);
    await trigger();

    const reloaded = await expect.poll(async () => electronApp.evaluate((_, id) => {
        return Boolean((global as any).__e2eReloadWatchers?.[id]?.detected);
    }, webContentsId), {
        timeout: 30_000,
        message: 'Server view reload must be detected after menu reload',
    }).toBe(true).then(() => true).catch(() => false);

    await activateServerView(electronApp, webContentsId);
    await closeDownloadsDropdownIfOpen(electronApp);
    await serverWin.keyboard.press('Escape').catch(() => {});

    return reloaded;
}

async function getServerContext() {
    const browserWindow = await electronApp.browserWindow(mainWindow);
    const serverMap = await buildServerMap(electronApp);
    const serverEntry = serverMap[demoMattermostConfig.servers[0].name][0];
    const firstServer = serverEntry.win;
    const firstServerId = serverEntry.webContentsId;

    await firstServer.waitForURL((url) => url.pathname.includes('/channels/'), {timeout: 30_000});
    await firstServer.waitForSelector('#post_textbox', {timeout: 30_000});
    await mainWindow.bringToFront().catch(() => {});
    await activateServerView(electronApp, serverEntry.webContentsId);

    return {browserWindow, firstServer, firstServerId};
}

test.describe('menu/view', () => {
    test.describe.configure({mode: 'serial'});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test.beforeAll(async () => {
        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-view-menu-e2e-'));
        electronApp = await launchDirectTestApp(userDataDir, demoMattermostConfig);

        mainWindow = await waitForWindow(electronApp, 'index');
        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);
        await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 30_000});
    });

    test.beforeEach(async () => {
        const {browserWindow, firstServerId} = await getServerContext();
        await setZoomFactorOfServer(browserWindow, firstServerId, 1);
    });

    test.afterAll(async () => {
        if (electronApp && userDataDir) {
            await closeElectronAppFast(electronApp, userDataDir);
        } else if (electronApp) {
            await electronApp.close().catch(() => {});
        }
    });

    test('MM-T813 Control+F should focus the search bar in Mattermost', {tag: ['@P2', '@all']}, async () => {
        const {firstServer, firstServerId} = await getServerContext();
        await activateServerView(electronApp, firstServerId);

        if (process.platform === 'darwin') {
            await firstServer.keyboard.press('Meta+f');
        } else {
            await openServerSearch(electronApp, firstServerId);
        }

        await waitForSearchBarFocused(firstServer);
        const isFocused = await firstServer.$eval(SEARCH_INPUT, (el) => el === document.activeElement);
        expect(isFocused).toBe(true);
        const text = await firstServer.inputValue(SEARCH_INPUT);
        expect(text).toContain('in:');
    });

    test('MM-T817 Actual Size Zoom in the menu bar', {tag: ['@P2', '@all']}, async () => {
        const {browserWindow, firstServerId} = await getServerContext();

        await clickViewMenuItemByAccelerator(electronApp, firstServerId, 'CmdOrCtrl+=');
        let zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
        expect(zoomLevel).toBeGreaterThan(1);

        await clickViewMenuItemByAccelerator(electronApp, firstServerId, 'CmdOrCtrl+0');
        zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
        expect(zoomLevel).toBe(1);
    });

    test.describe('MM-T818 Zoom in from the menu bar', () => {
        test('MM-T818_1 Zoom in when CmdOrCtrl+Plus is pressed', {tag: ['@P2', '@all']}, async () => {
            const {browserWindow, firstServerId} = await getServerContext();

            await clickViewMenuItemByAccelerator(electronApp, firstServerId, 'CmdOrCtrl+=');
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(zoomLevel).toBeGreaterThan(1);
            expect(zoomLevel).toBeLessThan(1.5);
        });

        test('MM-T818_2 Zoom in when CmdOrCtrl+Shift+Plus is pressed', {tag: ['@P2', '@all']}, async () => {
            const {browserWindow, firstServerId} = await getServerContext();
            const initialZoom = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(initialZoom).toBe(1);

            await clickViewMenuItemByAccelerator(electronApp, firstServerId, 'CmdOrCtrl+Shift+=');
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(zoomLevel).toBeGreaterThan(1);
        });
    });

    test.describe('MM-T819 Zoom out from the menu bar', () => {
        test('MM-T819_1 Zoom out when CmdOrCtrl+Minus is pressed', {tag: ['@P2', '@all']}, async () => {
            const {browserWindow, firstServerId} = await getServerContext();

            await clickViewMenuItemByAccelerator(electronApp, firstServerId, 'CmdOrCtrl+-');
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(zoomLevel).toBeLessThan(1);
        });

        test('MM-T819_2 Zoom out when CmdOrCtrl+Shift+Minus is pressed', {tag: ['@P2', '@all']}, async () => {
            const {browserWindow, firstServerId} = await getServerContext();
            const initialZoom = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(initialZoom).toBe(1);

            await clickViewMenuItemByAccelerator(electronApp, firstServerId, 'CmdOrCtrl+Shift+-');
            const zoomLevel = await getZoomFactorOfServer(browserWindow, firstServerId);
            expect(zoomLevel).toBeLessThan(1);
        });
    });

    test.describe('Reload', () => {
        test('MM-T814 should reload page when pressing Ctrl+R', {tag: ['@P2', '@all']}, async () => {
            const {firstServerId: webContentsId} = await getServerContext();
            await activateServerView(electronApp, webContentsId);

            const result = await waitForServerReload(electronApp, webContentsId, async () => {
                await clickViewMenuItemByAccelerator(electronApp, webContentsId, 'CmdOrCtrl+R');
            });
            expect(result).toBe(true);
        });

        test('MM-T815 should reload page when pressing Ctrl+Shift+R', {tag: ['@P2', '@all']}, async () => {
            const {firstServerId: webContentsId} = await getServerContext();
            await activateServerView(electronApp, webContentsId);

            const result = await waitForServerReload(electronApp, webContentsId, async () => {
                await clickViewMenuItemByAccelerator(electronApp, webContentsId, 'Shift+CmdOrCtrl+R');
            });
            expect(result).toBe(true);
        });
    });

    test('MM-T820 should open Developer Tools For Application Wrapper for main window', {tag: ['@P2', '@darwin', '@win32']}, async () => {
        const browserWindow = await electronApp.browserWindow(mainWindow);

        let isDevToolsOpen = await browserWindow.evaluate((window) => {
            return (window as any).webContents.isDevToolsOpened();
        });
        expect(isDevToolsOpen).toBe(false);

        await mainWindow.waitForLoadState();
        await mainWindow.bringToFront();
        await clickApplicationMenuItem(electronApp, 'view', {label: 'Developer Tools for Main Window'});

        await expect.poll(async () => browserWindow.evaluate((window) => {
            return (window as any).webContents.isDevToolsOpened();
        }), {
            timeout: 15_000,
            intervals: [250, 500, 1000, 2000],
        }).toBe(true);

        isDevToolsOpen = await browserWindow.evaluate((window) => {
            return (window as any).webContents.isDevToolsOpened();
        });
        expect(isDevToolsOpen).toBe(true);
    });
});
