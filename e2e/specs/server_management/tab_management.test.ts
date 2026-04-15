// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {waitForWindow, closeElectronApp} from '../../helpers/electronApp';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

const config = demoMattermostConfig;
type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;
type ElectronPage = import('playwright').Page;

let electronApp: ElectronApplication;
let mainWindow: ElectronPage;
let userDataDir: string;

async function getServerViews() {
    const serverMap = await buildServerMap(electronApp);
    return serverMap[config.servers[0].name];
}

async function getMattermostServer() {
    const serverEntries = await getServerViews();
    const mmServer = serverEntries?.[0]?.win;
    expect(mmServer).toBeDefined();
    return mmServer!;
}

async function resetTabs() {
    await electronApp.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        const currentServerId = refs?.ServerManager?.getCurrentServerId?.();
        if (!currentServerId) {
            return false;
        }

        const primaryView = refs.ViewManager.getPrimaryView(currentServerId);
        const orderedTabs = refs.TabManager.getOrderedTabsForServer(currentServerId);
        orderedTabs.forEach((tab: any) => {
            if (tab.id !== primaryView?.id) {
                refs.ViewManager.removeView(tab.id);
            }
        });

        if (primaryView) {
            refs.TabManager.switchToTab(primaryView.id);
        }

        return true;
    });

    mainWindow = await waitForWindow(electronApp, 'index');
    await mainWindow.bringToFront().catch(() => {});
    await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)', {timeout: 15_000});
}

test.describe('server_management/tab_management', () => {
    test.describe.configure({mode: 'serial'});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test.beforeAll(async () => {
        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-tab-management-e2e-'));
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
        await resetTabs();
    });

    test.afterAll(async () => {
        await closeElectronApp(electronApp, userDataDir);
    });

    test.describe('MM-TXXXX should be able to close server tabs', () => {
        test('MM-TXXXX_1 should close a server tab when clicking the x button', {tag: ['@P2', '@all']}, async () => {
            await mainWindow.click('#newTabButton');

            await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');

            const serverName = config.servers[0].name;
            let updatedServerMap = await buildServerMap(electronApp);
            const tabDeadline = Date.now() + 15_000;
            while ((!updatedServerMap[serverName] || updatedServerMap[serverName].length < 2) && Date.now() < tabDeadline) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                updatedServerMap = await buildServerMap(electronApp);
            }

            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            await secondTab.click();

            const secondView = updatedServerMap[serverName][1].win;
            await secondView.waitForSelector('#sidebarItem_off-topic', {timeout: 30_000});
            await secondView.click('#sidebarItem_off-topic');

            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTabEl = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            expect(firstTab).toBeDefined();
            expect(secondTabEl).toBeDefined();

            const secondTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2) .serverTabItem__close', {timeout: 15_000});
            await secondTabCloseButton.click();

            const remainingTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const thirdTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
            expect(remainingTab).toBeDefined();
            expect(thirdTab).toBeNull();
        });
    });

    test.describe('MM-TXXXX main tab for a server cannot be closed', () => {
        test('MM-TXXXX_2 should not show close button on the main tab when there is only one tab', {tag: ['@P2', '@all']}, async () => {
            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
            expect(firstTab).toBeDefined();
            expect(secondTab).toBeNull();

            const closeButton = await mainWindow.$('.TabBar li.serverTabItem .serverTabItem__close');
            expect(closeButton).toBeNull();
        });

        test('MM-TXXXX_3 should show close button on the main tab when there are multiple tabs', {tag: ['@P2', '@all']}, async () => {
            await mainWindow.click('#newTabButton');

            const firstTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)');
            const thirdTab = await mainWindow.$('.TabBar li.serverTabItem:nth-child(3)');
            expect(firstTab).toBeDefined();
            expect(secondTab).toBeDefined();
            expect(thirdTab).toBeNull();

            const firstTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1) .serverTabItem__close');
            const secondTabCloseButton = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2) .serverTabItem__close');
            expect(firstTabCloseButton).toBeDefined();
            expect(secondTabCloseButton).toBeDefined();

            await secondTabCloseButton.click();

            const remainingTab = await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(1)');
            const secondTabAfterClose = await mainWindow.$('.TabBar li.serverTabItem:nth-child(2)');
            expect(remainingTab).toBeDefined();
            expect(secondTabAfterClose).toBeNull();
        });
    });
});
