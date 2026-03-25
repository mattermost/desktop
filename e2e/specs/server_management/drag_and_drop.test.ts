// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

if (!process.env.MM_TEST_SERVER_URL) {
    test.skip(true, 'MM_TEST_SERVER_URL required');
}

const config = {
    ...demoMattermostConfig,
    servers: [
        ...demoMattermostConfig.servers,
        {
            name: 'google',
            url: 'https://google.com/',
            order: 2,
        },
    ],
    lastActiveServer: 0,
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

async function resetState() {
    await electronApp.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const servers = refs?.ServerManager?.getAllServers?.() ?? [];
        const serverIdsByName = new Map(servers.map((server: any) => [server.name, server.id]));
        const expectedOrder = ['example', 'github', 'google'].
            map((name) => serverIdsByName.get(name)).
            filter(Boolean);
        if (expectedOrder.length > 0) {
            refs.ServerManager.updateServerOrder(expectedOrder);
        }

        const exampleId = serverIdsByName.get('example');
        if (!exampleId) {
            return false;
        }

        const primaryView = refs.ViewManager.getPrimaryView(exampleId);
        const orderedTabs = refs.TabManager.getOrderedTabsForServer(exampleId);
        orderedTabs.forEach((tab: any) => {
            if (tab.id !== primaryView?.id) {
                refs.ViewManager.removeView(tab.id);
            }
        });

        refs.ServerManager.updateCurrentServer(exampleId);
        if (primaryView) {
            refs.TabManager.switchToTab(primaryView.id);
        }

        return true;
    });

    mainWindow = await waitForWindow(electronApp, 'index');
    await mainWindow.bringToFront().catch(() => {});
    await mainWindow.keyboard.press('Escape').catch(() => {});
    const mmServer = await getMattermostServer();
    await mmServer.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
    await mmServer.click('#sidebarItem_town-square').catch(() => {});
}

async function openServerDropdown() {
    await mainWindow.bringToFront().catch(() => {});
    await mainWindow.click('.ServerDropdownButton');
    const dropdownView = await waitForWindow(electronApp, 'dropdown');
    await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
    return dropdownView;
}

function readJsonFile<T>(filePath: string): T | undefined {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return undefined;
    }
}

async function getCurrentActiveTabId() {
    const tabId = await electronApp.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const currentServerId = refs?.ServerManager?.getCurrentServerId?.();
        if (!currentServerId) {
            return undefined;
        }

        return refs.TabManager.getCurrentTabForServer(currentServerId)?.id;
    });

    expect(tabId).toBeDefined();
    return tabId!;
}

async function getVisibleTabOrder() {
    const tabs = mainWindow.locator('.TabBar li.serverTabItem');
    const tabCount = await tabs.count();
    const order: string[] = [];

    for (let index = 0; index < tabCount; index++) {
        const tab = tabs.nth(index);
        await tab.click();
        order.push(await getCurrentActiveTabId());
    }

    return order;
}

test.describe('server_management/drag_and_drop', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeAll(async () => {
        userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mm-drag-drop-e2e-'));
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
        await resetState();
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp, userDataDir);
    });

    test.describe('MM-T2635 should be able to drag and drop tabs', () => {
        test('MM-T2635_1 should be in the original order', {tag: ['@P2', '@all']}, async () => {
            await mainWindow.click('#newTabButton');
            await mainWindow.click('#newTabButton');

            await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});
            await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15_000});

            // Wait until all 3 views are registered in WebContentsManager before accessing them.
            // Using buildServerMap by index avoids a race condition where the IPC tab-switch
            // message from the renderer hasn't yet been processed by the main process when
            // getCurrentActiveTabView() runs.
            const serverName = config.servers[0].name;
            let localServerMap = await buildServerMap(electronApp);
            await expect.poll(async () => {
                localServerMap = await buildServerMap(electronApp);
                return localServerMap[serverName]?.length ?? 0;
            }, {timeout: 30_000}).toBeGreaterThanOrEqual(3);

            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 10_000});
            await secondTab.click();
            const secondView = localServerMap[serverName][1].win;
            await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 30_000});
            await secondView.click('#sidebarItem_off-topic');

            const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 10_000});
            await thirdTab.click();
            const thirdView = localServerMap[serverName][2].win;
            await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
            await thirdView.click('#sidebarItem_town-square');

            // Tab titles update asynchronously after channel navigation — poll for each.
            await expect(mainWindow.locator('.TabBar li.serverTabItem:nth-child(1)')).toContainText('Town Square', {timeout: 15_000});
            await expect(mainWindow.locator('.TabBar li.serverTabItem:nth-child(2)')).toContainText('Off-Topic', {timeout: 15_000});
            await expect(mainWindow.locator('.TabBar li.serverTabItem:nth-child(3)')).toContainText('Town Square', {timeout: 15_000});
        });

        test('MM-T2635_2 after moving the tab to the right, the tab should be in the new order', {tag: ['@P2', '@all']}, async () => {
            await mainWindow.click('#newTabButton');
            await mainWindow.click('#newTabButton');

            await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});
            await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 15_000});

            const serverName = config.servers[0].name;
            let localServerMap = await buildServerMap(electronApp);
            await expect.poll(async () => {
                localServerMap = await buildServerMap(electronApp);
                return localServerMap[serverName]?.length ?? 0;
            }, {timeout: 30_000}).toBeGreaterThanOrEqual(3);

            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 10_000});
            await secondTab.click();
            const secondView = localServerMap[serverName][1].win;
            await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 30_000});
            await secondView.click('#sidebarItem_off-topic');

            const thirdTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)', {timeout: 10_000});
            await thirdTab.click();
            const thirdView = localServerMap[serverName][2].win;
            await thirdView.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
            await thirdView.click('#sidebarItem_town-square');

            const visibleTabOrder = await getVisibleTabOrder();

            await mainWindow.evaluate(async ({viewOrder}) => {
                const currentServer = await window.desktop.getCurrentServer();
                if (!currentServer?.id) {
                    throw new Error('No current server available for tab reorder');
                }
                window.desktop.updateTabOrder(currentServer.id, viewOrder);
            }, {viewOrder: [visibleTabOrder[1], visibleTabOrder[0], visibleTabOrder[2]]});

            await expect.poll(async () => {
                const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
                return firstTab.innerText();
            }, {timeout: 10_000}).toContain('Off-Topic');

            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const firstTabText = await firstTab.innerText();
            expect(firstTabText).toContain('Off-Topic');
            const secondTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            const secondTabText = await secondTabEl.innerText();
            expect(secondTabText).toContain('Town Square');
            const thirdTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(3)');
            const thirdTabText = await thirdTabEl.innerText();
            expect(thirdTabText).toContain('Town Square');
        });
    });

    test.describe('MM-T2634 should be able to drag and drop servers in the dropdown menu', () => {
        test('MM-T2634_1 should appear the original order', {tag: ['@P2', '@all']}, async () => {
            const dropdownView = await openServerDropdown();

            const firstMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
            const firstMenuItemText = await firstMenuItem.innerText();
            expect(firstMenuItemText).toBe('example');
            const secondMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(2) .ServerDropdown__draggable-handle');
            const secondMenuItemText = await secondMenuItem.innerText();
            expect(secondMenuItemText).toBe('github');
            const thirdMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(3) .ServerDropdown__draggable-handle');
            const thirdMenuItemText = await thirdMenuItem.innerText();
            expect(thirdMenuItemText).toBe('google');
        });

        test('MM-T2634_2 after dragging the server down, should appear in the new order', {tag: ['@P2', '@all']}, async () => {
            let dropdownView = await openServerDropdown();

            await mainWindow.evaluate(async () => {
                const servers = await window.desktop.getOrderedServers();
                window.desktop.updateServerOrder([servers[1].id!, servers[0].id!, servers[2].id!]);
            });

            await mainWindow.keyboard.press('Escape');
            dropdownView = await openServerDropdown();

            await expect.poll(async () => {
                const firstMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(1) .ServerDropdown__draggable-handle');
                return firstMenuItem.innerText();
            }, {timeout: 10_000}).toBe('github');

            const secondMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(2) .ServerDropdown__draggable-handle');
            const secondMenuItemText = await secondMenuItem.innerText();
            expect(secondMenuItemText).toBe('example');
            const thirdMenuItem = await dropdownView.waitForSelector('.ServerDropdown button.ServerDropdown__button:nth-child(3) .ServerDropdown__draggable-handle');
            const thirdMenuItemText = await thirdMenuItem.innerText();
            expect(thirdMenuItemText).toBe('google');
        });

        test('MM-T2634_3 should update the config file', {tag: ['@P2', '@all']}, async () => {
            await openServerDropdown();

            await mainWindow.evaluate(async () => {
                const servers = await window.desktop.getOrderedServers();
                window.desktop.updateServerOrder([servers[1].id!, servers[0].id!, servers[2].id!]);
            });

            const configPath = path.join(userDataDir, 'config.json');
            await expect.poll(() => {
                const cfg = readJsonFile<{servers: Array<{name: string; order: number}>}>(configPath);
                const order0 = cfg?.servers?.find((s: {name: string}) => s.name === 'github');
                return order0?.order;
            }, {timeout: 10_000}).toBe(0);

            const newConfig = readJsonFile<{servers: Array<{name: string; order: number}>}>(configPath)!;
            const order0 = newConfig.servers.find((s: {name: string; order: number}) => s.name === 'github');
            expect(order0.order).toBe(0);
            const order1 = newConfig.servers.find((s: {name: string; order: number}) => s.name === 'example');
            expect(order1.order).toBe(1);
            const order2 = newConfig.servers.find((s: {name: string; order: number}) => s.name === 'google');
            expect(order2.order).toBe(2);
        });
    });
});
