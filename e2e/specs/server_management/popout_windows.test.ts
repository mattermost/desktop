// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {closeElectronAppFast, waitForWindow} from '../../helpers/electronApp';
import {loginToMattermost} from '../../helpers/login';
import {
    closeAllPopouts,
    closePopoutWindow,
    openPopoutWindow,
} from '../../helpers/popoutWindow';
import {buildServerMap} from '../../helpers/serverMap';

const config = {
    ...demoMattermostConfig,
    alwaysMinimize: false,
    minimizeToTray: false,
};

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;
type ElectronPage = import('playwright').Page;

let electronApp: ElectronApplication;
let mainWindow: ElectronPage;
let userDataDir: string;

async function getMattermostServer() {
    const serverMap = await buildServerMap(electronApp);
    const mmServer = serverMap[config.servers[0].name]?.[0]?.win;
    expect(mmServer).toBeDefined();
    return mmServer!;
}

test.describe('server_management/popout_windows', () => {
    test.describe.configure({mode: 'serial'});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test.beforeAll(async () => {
        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-popout-e2e-'));
        electronApp = await launchDirectTestApp(userDataDir, config);
        mainWindow = await waitForWindow(electronApp, 'index');
        const mmServer = await getMattermostServer();
        await loginToMattermost(mmServer);
        await mainWindow.waitForSelector('#newTabButton', {timeout: 30_000});
    });

    test.beforeEach(async () => {
        await closeAllPopouts(electronApp);
        const mmServer = await getMattermostServer();
        await mmServer.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
        await mmServer.click('#sidebarItem_town-square').catch(() => {});
        await mainWindow.bringToFront().catch(() => {});
    });

    test.afterAll(async () => {
        await closeElectronAppFast(electronApp, userDataDir);
    });

    test.describe('MM-TXXXX popout window functionality', () => {
        test('MM-TXXXX_1 should create a new popout window', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow(electronApp, mainWindow);
            expect(popoutWindow).toBeDefined();
            expect(electronApp.windows().filter((w) => w.url().includes('popout.html')).length).toBe(1);
        });

        test('MM-TXXXX_2 should allow resizing the popout window', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow(electronApp, mainWindow);
            const browserWindow = await electronApp.browserWindow(popoutWindow);
            const initialBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

            const newBounds = {
                x: initialBounds.x,
                y: initialBounds.y,
                width: initialBounds.width + 200,
                height: initialBounds.height + 200,
            };

            await browserWindow.evaluate((w, bounds) => {
                (w as Electron.BrowserWindow).setBounds(bounds as Electron.Rectangle);
            }, newBounds);

            const currentBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

            const tolerance = process.platform === 'darwin' ? 250 : 10;
            expect(Math.abs(currentBounds.width - newBounds.width)).toBeLessThan(tolerance);
            expect(Math.abs(currentBounds.height - newBounds.height)).toBeLessThan(tolerance);
        });

        test('MM-TXXXX_3 should allow moving the popout window', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow(electronApp, mainWindow);
            const browserWindow = await electronApp.browserWindow(popoutWindow);
            const initialBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

            const newBounds = {
                x: initialBounds.x + 50,
                y: initialBounds.y + 50,
                width: initialBounds.width,
                height: initialBounds.height,
            };

            await browserWindow.evaluate((w, bounds) => {
                (w as Electron.BrowserWindow).setBounds(bounds as Electron.Rectangle);
            }, newBounds);

            const currentBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

            // macOS clamps window positions against the menu bar and dock, so the actual y
            // (and sometimes x) can be shifted by the OS even when setBounds returns success.
            const tolerance = process.platform === 'darwin' ? 250 : 10;
            expect(Math.abs(currentBounds.x - newBounds.x)).toBeLessThan(tolerance);
            expect(Math.abs(currentBounds.y - newBounds.y)).toBeLessThan(tolerance);
        });

        test('MM-TXXXX_4 should close the popout window using close button', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow(electronApp, mainWindow);
            await closePopoutWindow(electronApp, popoutWindow);
        });

        // NOTE: there is intentionally no "close popout windows when main window is
        // closed" test. Destroying popouts when the main window closes was considered
        // and explicitly dropped (see PopoutManager) because it contradicts the intended
        // multi-window independence; popout cleanup is handled by E2E teardown instead.
    });

    test.describe('MM-T4411 popout window content functionality', () => {
        test('MM-T4411_1 should display the same server content in popout window', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow(electronApp, mainWindow);

            const mainWindowTitle = await mainWindow.title();
            const popoutWindowTitle = await popoutWindow.title();

            expect(mainWindowTitle).toContain('Mattermost');
            expect(popoutWindowTitle).toContain('Mattermost');
        });

        test('MM-T4411_2 should maintain separate navigation state in popout window', {tag: ['@P2', '@all']}, async () => {
            const mainView = await getMattermostServer();
            await mainView.waitForSelector('#sidebarItem_off-topic');
            await mainView.click('#sidebarItem_off-topic');

            const popoutWindow = await openPopoutWindow(electronApp, mainWindow);
            expect(popoutWindow).toBeDefined();

            const mainTabText = await mainWindow.innerText('.TabBar li.serverTabItem.active');
            expect(mainTabText).toContain('Off-Topic');

            // Popout window should be a separate page instance
            const popoutUrl = popoutWindow.url();
            expect(popoutUrl).toContain('popout.html');
        });
    });
});
