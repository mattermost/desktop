// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {buildServerMap} from '../../helpers/serverMap';
import {appDir, cmdOrCtrl, demoMattermostConfig, electronBinaryPath, writeConfigFile} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

const windowMenuConfig = {
    ...demoMattermostConfig,
    servers: [
        ...demoMattermostConfig.servers,
        {
            name: 'community',
            url: 'https://community.mattermost.com',
            order: 2,
        },
    ],
    lastActiveServer: 0,
};

test.describe.configure({mode: 'serial'});

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;
type ElectronPage = import('playwright').Page;

let electronApp: ElectronApplication;
let mainWindow: ElectronPage;
let serverMap: Awaited<ReturnType<typeof buildServerMap>>;
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

async function clickWindowMenuItem(
    app: ElectronApplication,
    matcher: {label?: string; labelIncludes?: string; accelerator?: string; role?: string},
) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            await app.evaluate(({app, BrowserWindow}, expected) => {
                const normalizeAccelerator = (value?: string) => {
                    return (value ?? '').
                        toLowerCase().
                        replace(/commandorcontrol/g, 'cmdorctrl').
                        replace(/command/g, 'cmd').
                        replace(/control/g, 'ctrl').
                        replace(/option/g, 'alt').
                        replace(/\s+/g, '');
                };

                const windowMenu = app.applicationMenu.getMenuItemById('window');
                const items = windowMenu?.submenu?.items ?? [];
                const item = items.find((candidate: any) => {
                    if (expected.role && candidate.role !== expected.role) {
                        return false;
                    }
                    if (expected.accelerator && normalizeAccelerator(candidate.accelerator) !== normalizeAccelerator(expected.accelerator)) {
                        return false;
                    }
                    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
                    if (expected.label && label !== expected.label) {
                        return false;
                    }
                    if (expected.labelIncludes && !label.includes(expected.labelIncludes)) {
                        return false;
                    }
                    return true;
                });

                if (!item) {
                    // Use a sentinel that the outer catch can recognise and retry on,
                    // since MenuManager rebuilds the menu asynchronously after TAB_ADDED.
                    throw new Error(`__MENU_ITEM_NOT_FOUND__: ${JSON.stringify(expected)}`);
                }

                // getFocusedWindow() may return null in headless CI; use the main window ref
                const refs = (global as any).__e2eTestRefs;
                const targetWindow = BrowserWindow.getFocusedWindow() ??
                    refs?.MainWindow?.get?.() ??
                    BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ??
                    null;
                item.click(undefined, targetWindow, undefined);
            }, matcher);
            return;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            // Retry on context destruction (navigation) or menu not yet rebuilt after TAB_ADDED.
            if (
                !message.includes('Execution context was destroyed') &&
                !message.includes('__MENU_ITEM_NOT_FOUND__')
            ) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    throw new Error(`Timed out clicking window menu item: ${JSON.stringify(matcher)}`);
}

async function evaluateWithRetry<T>(
    app: ElectronApplication,
    pageFunction: () => T,
) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        try {
            return await app.evaluate(pageFunction);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed')) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    throw new Error('Timed out waiting for electron evaluation to survive navigation');
}

async function getCurrentServerName(
    app: ElectronApplication,
) {
    return evaluateWithRetry(app, () => {
        const refs = (global as any).__e2eTestRefs;
        const currentServerId = refs?.ServerManager?.getCurrentServerId?.();
        const server = currentServerId ? refs?.ServerManager?.getServer?.(currentServerId) : undefined;
        return server?.name ?? '';
    });
}

async function getActiveTabTitle(
    app: ElectronApplication,
) {
    return evaluateWithRetry(app, () => {
        const refs = (global as any).__e2eTestRefs;
        const activeView = refs?.TabManager?.getCurrentActiveTabView?.();
        return activeView ? refs?.ViewManager?.getViewTitle?.(activeView.id) ?? '' : '';
    });
}

function getMattermostServer() {
    const mmServer = serverMap[windowMenuConfig.servers[0].name]?.[0]?.win;
    expect(mmServer, 'Mattermost server view should exist').toBeTruthy();
    return mmServer!;
}

async function focusMainWindow() {
    const deadline = Date.now() + 15_000;
    let focused = false;

    while (Date.now() < deadline) {
        try {
            focused = await electronApp.evaluate(({app}) => {
                const refs = (global as any).__e2eTestRefs;
                const mainWindow = refs?.MainWindow?.get?.();
                if (!mainWindow || mainWindow.isDestroyed()) {
                    return false;
                }

                if (process.platform === 'darwin') {
                    app.show();
                }

                if (mainWindow.isMinimized()) {
                    mainWindow.restore();
                }
                mainWindow.show();
                mainWindow.focus();
                return true;
            });
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed')) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    expect(focused, 'Failed to focus the main window').toBe(true);
    mainWindow = await waitForWindow(electronApp, 'index');
    await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 30_000});
    await mainWindow.bringToFront().catch(() => {});
}

async function resetWindowMenuState() {
    await focusMainWindow();
    const resetResult = await evaluateWithRetry(electronApp, () => {
        const refs = (global as any).__e2eTestRefs;
        const exampleServer = refs?.ServerManager?.getAllServers?.().find((server: any) => server.name === 'example');
        if (!exampleServer) {
            return false;
        }

        const primaryView = refs.ViewManager.getPrimaryView(exampleServer.id);
        const orderedTabs = refs.TabManager.getOrderedTabsForServer(exampleServer.id);
        orderedTabs.forEach((tab: any) => {
            if (tab.id !== primaryView?.id) {
                refs.ViewManager.removeView(tab.id);
            }
        });

        refs.ServerManager.updateCurrentServer(exampleServer.id);
        if (primaryView) {
            refs.TabManager.switchToTab(primaryView.id);
        }

        return true;
    });

    expect(resetResult, 'Failed to restore the example server state').toBe(true);
    serverMap = await buildServerMap(electronApp);
    await focusMainWindow();
}

async function createExtraTabs() {
    await mainWindow.click('#newTabButton');
    await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});
    await mainWindow.click('#newTabButton');
    await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15_000});

    // Wait until WebContentsManager has registered all 3 views
    const serverName = windowMenuConfig.servers[0].name;
    let map = await buildServerMap(electronApp);
    const deadline = Date.now() + 15_000;
    while ((map[serverName]?.length ?? 0) < 3 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        map = await buildServerMap(electronApp);
    }
    return map;
}

test.describe('Menu/window_menu', () => {
    test.beforeAll(async () => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-window-menu-e2e-'));
        writeConfigFile(userDataDir, windowMenuConfig);

        const {_electron: electron} = await import('playwright');
        electronApp = await electron.launch({
            executablePath: electronBinaryPath,
            args: [
                appDir,
                `--user-data-dir=${userDataDir}`,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-software-rasterizer',
                '--disable-breakpad',
                '--disable-features=SpareRendererForSitePerProcess',
                '--disable-features=CrossOriginOpenerPolicy',
                '--disable-renderer-backgrounding',
                '--force-color-profile=srgb',
                '--mute-audio',
            ],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                RESOURCES_PATH: appDir,
                ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
                ELECTRON_NO_ATTACH_CONSOLE: 'true',
                NODE_OPTIONS: '--no-warnings',
            },
            timeout: 90_000,
        });

        await waitForAppReady(electronApp);
        mainWindow = await waitForWindow(electronApp, 'index');
        serverMap = await buildServerMap(electronApp);

        await loginToMattermost(getMattermostServer());
        await focusMainWindow();
    });

    test.beforeEach(async () => {
        await resetWindowMenuState();
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp, userDataDir);
    });

    test.describe('MM-T826 should switch to servers when keyboard shortcuts are pressed', () => {
        test('MM-T826_1 should show the second server', {tag: ['@P2', '@all']}, async () => {
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
            expect(dropdownButtonText).toContain('example');

            await clickWindowMenuItem(electronApp, {label: 'github'});
            await expect.poll(() => getCurrentServerName(electronApp)).toBe('github');
        });

        test('MM-T826_2 should show the third server', {tag: ['@P2', '@all']}, async () => {
            await clickWindowMenuItem(electronApp, {label: 'github'});
            await clickWindowMenuItem(electronApp, {label: 'community'});
            await expect.poll(() => getCurrentServerName(electronApp)).toBe('community');
        });

        test('MM-T826_3 should show the first server', {tag: ['@P2', '@all']}, async () => {
            await clickWindowMenuItem(electronApp, {label: 'github'});
            await clickWindowMenuItem(electronApp, {label: 'example'});
            await expect.poll(() => getCurrentServerName(electronApp)).toBe('example');
        });
    });

    test.describe('MM-T4385 select tab from menu', () => {
        test('MM-T4385_1 should show the second tab', {tag: ['@P2', '@all']}, async () => {
            const updatedServerMap = await createExtraTabs();

            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});
            await secondTab.click();
            const secondView = updatedServerMap[windowMenuConfig.servers[0].name]?.[1]?.win;
            expect(secondView, 'Second Mattermost tab should exist').toBeTruthy();
            await secondView!.waitForSelector('#sidebarItem_off-topic', {timeout: 15_000});
            await secondView!.click('#sidebarItem_off-topic');

            const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15_000});
            await thirdTab.click();
            const thirdView = updatedServerMap[windowMenuConfig.servers[0].name]?.[2]?.win;
            expect(thirdView, 'Third Mattermost tab should exist').toBeTruthy();
            await thirdView!.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
            await thirdView!.click('#sidebarItem_town-square');

            // Tab title updates asynchronously after channel navigation — poll for it.
            await expect(mainWindow.locator('.active')).toContainText('Town Square', {timeout: 10_000});

            await clickWindowMenuItem(electronApp, {accelerator: 'CmdOrCtrl+2'});
            await expect.poll(() => getActiveTabTitle(electronApp), {timeout: 15_000}).toContain('Off-Topic');
        });

        test('MM-T4385_2 should show the third tab', {tag: ['@P2', '@all']}, async () => {
            const updatedServerMap = await createExtraTabs();

            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});
            await secondTab.click();
            const secondView = updatedServerMap[windowMenuConfig.servers[0].name]?.[1]?.win;
            expect(secondView, 'Second Mattermost tab should exist').toBeTruthy();
            await secondView!.waitForSelector('#sidebarItem_off-topic', {timeout: 15_000});
            await secondView!.click('#sidebarItem_off-topic');

            const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15_000});
            await thirdTab.click();
            const thirdView = updatedServerMap[windowMenuConfig.servers[0].name]?.[2]?.win;
            expect(thirdView, 'Third Mattermost tab should exist').toBeTruthy();
            await thirdView!.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
            await thirdView!.click('#sidebarItem_town-square');

            await clickWindowMenuItem(electronApp, {accelerator: 'CmdOrCtrl+2'});
            await clickWindowMenuItem(electronApp, {accelerator: 'CmdOrCtrl+3'});
            await expect.poll(() => getActiveTabTitle(electronApp), {timeout: 15_000}).toContain('Town Square');
        });

        test('MM-T4385_3 should show the first tab', {tag: ['@P2', '@all']}, async () => {
            const updatedServerMap = await createExtraTabs();

            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});
            await secondTab.click();
            const secondView = updatedServerMap[windowMenuConfig.servers[0].name]?.[1]?.win;
            expect(secondView, 'Second Mattermost tab should exist').toBeTruthy();
            await secondView!.waitForSelector('#sidebarItem_off-topic', {timeout: 15_000});
            await secondView!.click('#sidebarItem_off-topic');

            const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15_000});
            await thirdTab.click();
            const thirdView = updatedServerMap[windowMenuConfig.servers[0].name]?.[2]?.win;
            expect(thirdView, 'Third Mattermost tab should exist').toBeTruthy();
            await thirdView!.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
            await thirdView!.click('#sidebarItem_town-square');

            await clickWindowMenuItem(electronApp, {accelerator: 'CmdOrCtrl+2'});
            await clickWindowMenuItem(electronApp, {accelerator: 'CmdOrCtrl+1'});
            await expect.poll(() => getActiveTabTitle(electronApp), {timeout: 15_000}).toContain('Town Square');
        });
    });

    test('MM-T827 select next/previous tab', {tag: ['@P2', '@all']}, async () => {
        await mainWindow.click('#newTabButton');
        const updatedServerMap = await buildServerMap(electronApp);

        const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
        await secondTab.click();
        const secondView = updatedServerMap[windowMenuConfig.servers[0].name]?.[1]?.win;
        expect(secondView, 'Second Mattermost tab should exist').toBeTruthy();
        await secondView!.waitForSelector('#sidebarItem_off-topic', {timeout: 10_000});
        await secondView!.click('#sidebarItem_off-topic');

        await expect.poll(() => getActiveTabTitle(electronApp), {timeout: 15_000}).toContain('Off-Topic');

        await clickWindowMenuItem(electronApp, {label: 'Select Next Tab'});
        await expect.poll(() => getActiveTabTitle(electronApp), {timeout: 15_000}).toContain('Town Square');

        await clickWindowMenuItem(electronApp, {label: 'Select Previous Tab'});
        await expect.poll(() => getActiveTabTitle(electronApp), {timeout: 15_000}).toContain('Off-Topic');
    });

    test('MM-T824 should be minimized when keyboard shortcuts are pressed', {tag: ['@P2', '@darwin', '@win32']}, async () => {
        if (process.platform === 'linux') {
            test.skip(true, 'Linux not supported');
            return;
        }
        const browserWindow = await electronApp.browserWindow(mainWindow);

        if (process.platform === 'darwin') {
            // macOS: Cmd+M is the standard minimize shortcut
            await mainWindow.keyboard.press('Meta+m');
        } else {
            // Windows: navigate the three-dot menu (Window > Minimize)
            await mainWindow.click('button.three-dot-menu');
            await mainWindow.keyboard.press('w');
            await mainWindow.keyboard.press('m');
            await mainWindow.keyboard.press('Enter');
        }

        await expect.poll(async () => {
            return browserWindow.evaluate((window) => (window as any).isMinimized());
        }).toBe(true);
    });

    test('MM-T825 should be hidden when keyboard shortcuts are pressed', {tag: ['@P2', '@darwin', '@win32']}, async () => {
        if (process.platform === 'linux') {
            test.skip(true, 'Linux not supported');
            return;
        }
        const browserWindow = await electronApp.browserWindow(mainWindow);

        if (process.platform === 'darwin') {
            // macOS: app.hide() hides all windows without closing (Cmd+H behavior)
            await electronApp.evaluate(({app}) => {
                app.hide();
            });
        } else {
            // Windows: Ctrl+W closes the focused window (different semantics than macOS hide)
            await mainWindow.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+w`);
        }

        await expect.poll(async () => {
            return browserWindow.evaluate((window) => (window as any).isVisible());
        }).toBe(false);
        const isDestroyed = await browserWindow.evaluate((window) => (window as any).isDestroyed());
        expect(isDestroyed).toBe(false);
    });
});
