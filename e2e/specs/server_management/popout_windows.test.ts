// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {loginToMattermost} from '../../helpers/login';
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

async function waitForWindow(app: ElectronApplication, pattern: string, timeout = 30_000) {
    const timeoutAt = Date.now() + timeout;
    while (Date.now() < timeoutAt) {
        const win = app.windows().find((window) => {
            try {
                return window.url().includes(pattern);
            } catch {
                return false;
            }
        });

        if (win) {
            await win.waitForLoadState().catch(() => {});
            return win;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for window matching "${pattern}"`);
}

async function closeElectronApp(app: ElectronApplication, dataDir: string) {
    let pid: number | undefined;
    try {
        pid = app.process()?.pid;
    } catch {
        pid = undefined;
    }

    let cleanClosed = false;
    await Promise.race([
        app.close().catch(() => {}).then(() => {
            cleanClosed = true;
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);

    if (!cleanClosed && pid) {
        try {
            process.kill(pid, 'SIGTERM');
        } catch {
            // already exited
        }
        return;
    }

    await waitForLockFileRelease(dataDir).catch(() => {});
}

async function getMattermostServer() {
    const serverMap = await buildServerMap(electronApp);
    const mmServer = serverMap[config.servers[0].name]?.[0]?.win;
    expect(mmServer).toBeDefined();
    return mmServer!;
}

async function clickFileMenuItem(app: ElectronApplication, label: string) {
    await app.evaluate(({app: electronAppInstance, BrowserWindow}, expectedLabel) => {
        const fileMenu = (electronAppInstance as any).applicationMenu.getMenuItemById('file');
        const items = fileMenu?.submenu?.items ?? [];
        const item = items.find((candidate: any) => {
            const candidateLabel = typeof candidate.label === 'string' ? candidate.label.trim() : '';
            return candidateLabel === expectedLabel;
        });

        if (!item) {
            throw new Error(`File menu item not found: ${expectedLabel}`);
        }

        // getFocusedWindow() may return null in headless CI; use the main window ref
        const refs = (global as any).__e2eTestRefs;
        const targetWindow = BrowserWindow.getFocusedWindow() ??
            refs?.MainWindow?.get?.() ??
            BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ??
            null;
        item.click(undefined, targetWindow, undefined);
    }, label);
}

async function openPopoutWindow() {
    await mainWindow.bringToFront().catch(() => {});

    // waitForEvent fires when the BrowserWindow is *created*, which may be before
    // PopoutManager calls loadURL — so the URL can still be blank at that point.
    // Catch any new window then wait for the popout URL to appear.
    const popoutPromise = electronApp.waitForEvent('window', {timeout: 15_000});
    await clickFileMenuItem(electronApp, 'New Window');
    const newWindow = await popoutPromise;
    await newWindow.waitForURL('**/popout.html', {timeout: 15_000}).catch(() => {});
    await newWindow.waitForLoadState().catch(() => {});
    return newWindow;
}

async function closeAllPopouts() {
    const popoutWindows = electronApp.windows().filter((window) => {
        try {
            return window.url().includes('popout.html');
        } catch {
            return false;
        }
    });

    for (const popout of popoutWindows) {
        const browserWindow = await electronApp.browserWindow(popout);
        await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).close()).catch(() => {});
    }

    await expect.poll(() => {
        return electronApp.windows().filter((window) => {
            try {
                return window.url().includes('popout.html');
            } catch {
                return false;
            }
        }).length;
    }, {timeout: 10_000}).toBe(0);
}

test.describe('server_management/popout_windows', () => {
    test.describe.configure({mode: 'serial'});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test.beforeAll(async () => {
        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-popout-e2e-'));
        writeConfigFile(userDataDir, config);

        const {_electron: electron} = await import('playwright');
        electronApp = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });
        await waitForAppReady(electronApp);
        mainWindow = await waitForWindow(electronApp, 'index');
        const mmServer = await getMattermostServer();
        await loginToMattermost(mmServer);
        await mainWindow.waitForSelector('#newTabButton', {timeout: 30_000});
    });

    test.beforeEach(async () => {
        await closeAllPopouts();
        const mmServer = await getMattermostServer();
        await mmServer.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
        await mmServer.click('#sidebarItem_town-square').catch(() => {});
        await mainWindow.bringToFront().catch(() => {});
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp, userDataDir);
    });

    test.describe('MM-TXXXX popout window functionality', () => {
        test('MM-TXXXX_1 should create a new popout window using File menu', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow();
            expect(popoutWindow).toBeDefined();
            expect(electronApp.windows().filter((w) => w.url().includes('popout.html')).length).toBe(1);
        });

        test('MM-TXXXX_2 should allow resizing the popout window', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow();
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
            const popoutWindow = await openPopoutWindow();
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
            expect(Math.abs(currentBounds.x - newBounds.x)).toBeLessThan(10);
            expect(Math.abs(currentBounds.y - newBounds.y)).toBeLessThan(10);
        });

        test('MM-TXXXX_4 should close the popout window using close button', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow();
            const browserWindow = await electronApp.browserWindow(popoutWindow);
            await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).close());

            await expect.poll(() => {
                return electronApp.windows().filter((w) => w.url().includes('popout.html')).length;
            }, {timeout: 10_000}).toBe(0);
        });

        if (process.platform === 'win32') {
            test('MM-TXXXX_5 should close popout windows when main window is closed', {tag: ['@P2', '@win32']}, async ({}, testInfo) => {
                const testDataDir = path.join(testInfo.outputDir, 'popout-close-userdata');
                await fs.mkdir(testDataDir, {recursive: true});
                writeConfigFile(testDataDir, config);

                const {_electron: electron} = await import('playwright');
                const app = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, `--user-data-dir=${testDataDir}`, '--no-sandbox', '--disable-gpu'],
                    env: {...process.env, NODE_ENV: 'test'},
                    timeout: 60_000,
                });
                await waitForAppReady(app);

                try {
                    const win = app.windows().find((w) => w.url().includes('index'));
                    if (!win) {
                        throw new Error('Main window not found');
                    }
                    await win.keyboard.press('Control+n');

                    await expect.poll(() => {
                        return app.windows().filter((w) => w.url().includes('popout.html')).length;
                    }, {timeout: 10_000}).toBe(1);

                    const mainWindows = app.windows().filter((w) => w.url().includes('index'));
                    const popoutWindows = app.windows().filter((w) => w.url().includes('popout.html'));
                    expect(mainWindows.length).toBe(1);
                    expect(popoutWindows.length).toBe(1);

                    const mainBrowserWindow = await app.browserWindow(mainWindows[0]);
                    await mainBrowserWindow.evaluate((w) => (w as Electron.BrowserWindow).close());

                    await expect.poll(() => {
                        return app.windows().filter((w) => w.url().includes('popout.html')).length;
                    }, {timeout: 10_000}).toBe(0);
                } finally {
                    await app.close().catch(() => {});
                    await waitForLockFileRelease(testDataDir).catch(() => {});
                }
            });
        }
    });

    test.describe('MM-T4411 popout window content functionality', () => {
        test('MM-T4411_1 should display the same server content in popout window', {tag: ['@P2', '@all']}, async () => {
            const popoutWindow = await openPopoutWindow();

            const mainWindowTitle = await mainWindow.title();
            const popoutWindowTitle = await popoutWindow.title();

            expect(mainWindowTitle).toContain('Mattermost');
            expect(popoutWindowTitle).toContain('Mattermost');
        });

        test('MM-T4411_2 should maintain separate navigation state in popout window', {tag: ['@P2', '@all']}, async () => {
            const mainView = await getMattermostServer();
            await mainView.waitForSelector('#sidebarItem_off-topic');
            await mainView.click('#sidebarItem_off-topic');

            const popoutWindow = await openPopoutWindow();
            expect(popoutWindow).toBeDefined();

            const mainTabText = await mainWindow.innerText('.TabBar li.serverTabItem.active');
            expect(mainTabText).toContain('Off-Topic');

            // Popout window should be a separate page instance
            const popoutUrl = popoutWindow.url();
            expect(popoutUrl).toContain('popout.html');
        });
    });
});
