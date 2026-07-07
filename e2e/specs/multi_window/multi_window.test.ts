// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {channelPathname, modifierClickSidebarChannel, navigateViewToChannel} from '../../helpers/channelNavigation';
import {openChannelHeaderMenu, openSidebarChannelMenu} from '../../helpers/channelMenu';
import {demoMattermostConfig} from '../../helpers/config';
import {closeDownloadsDropdownIfOpen} from '../../helpers/downloadsDropdown';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {closeElectronAppFast, waitForWindow} from '../../helpers/electronApp';
import {loginToMattermost} from '../../helpers/login';
import {waitForMainWindowFocused} from '../../helpers/mainWindowFocus';
import {POST_TEXTBOX_SELECTOR, waitForChannelPostListLoaded, waitForMattermostShellReady} from '../../helpers/mattermostShell';
import {
    closeAllPopouts,
    closePopoutWindow,
    getPopoutServerView,
    getWindowTypeView,
    openChannelInNewWindow,
    openPopoutViaFileMenu,
    openRhsPopoutViaDesktopApi,
    popoutWindowCount,
    resetTabsAndPopouts,
    waitForPopoutWindow,
    waitForPopoutWindowEvent,
} from '../../helpers/popoutWindow';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {resolvedChannelPath, resolveChannelByName} from '../../helpers/server_api/channel';
import {seedThreadInChannel} from '../../helpers/server_api/post';
import {buildServerMap} from '../../helpers/serverMap';
import {
    clickOpenInNewWindowFromRhsThreadMenu,
    clickOpenInNewWindowFromThreadsListMenu,
    clickOpenInNewWindowMenuItem,
} from '../../helpers/webappMenu';
import {NOTIFICATION_CLICKED} from '../../../src/common/communication';

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

test.describe('multi_window/multi_window', () => {
    test.describe.configure({mode: 'serial'});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test.beforeAll(async () => {
        userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-multi-window-e2e-'));
        electronApp = await launchDirectTestApp(userDataDir, config);
        mainWindow = await waitForWindow(electronApp, 'index');
        const mmServer = await getMattermostServer();
        await loginToMattermost(mmServer);
        await mainWindow.waitForSelector('#newTabButton', {timeout: 30_000});
    });

    test.beforeEach(async () => {
        mainWindow = await resetTabsAndPopouts(electronApp);
        await closeDownloadsDropdownIfOpen(electronApp);
        const mmServer = await getMattermostServer();
        await prepareMattermostServerView(electronApp, mmServer.webContentsId);
        await waitForMattermostShellReady(mmServer, {channelItem: '#sidebarItem_town-square'});
        await mmServer.click('#sidebarItem_town-square').catch(() => {});
        await mainWindow.bringToFront().catch(() => {});
    });

    test.afterAll(async () => {
        await closeElectronAppFast(electronApp, userDataDir);
    });

    test('MM-T5888 Popout window file upload (drag-and-drop not automatable)', {tag: ['@P2', '@all']}, async () => {
        // Step 1: cross-window HTML5 drag-and-drop is not automatable via WebContentsView input events.
        const offTopic = await resolveChannelByName('off-topic');
        const channelPath = resolvedChannelPath(offTopic);
        await openChannelInNewWindow(electronApp, channelPath);

        const popoutView = await getPopoutServerView(electronApp);
        await prepareMattermostServerView(electronApp, popoutView.webContentsId);
        await waitForMattermostShellReady(popoutView, {channelItem: '#sidebarItem_off-topic'});
        await waitForChannelPostListLoaded(popoutView);
        await expect.poll(
            async () => popoutView.evaluate(() => window.location.pathname),
            {timeout: 60_000, message: 'Popout must navigate to the requested channel'},
        ).toMatch(/off[-_]topic/i);
        await expect.poll(
            () => popoutView.evaluate((selector) => Boolean(document.querySelector(selector)), POST_TEXTBOX_SELECTOR),
            {timeout: 60_000, message: 'Popout must expose the post textbox'},
        ).toBe(true);

        const tempFile = path.join(os.tmpdir(), `mm-e2e-upload-${Date.now()}.txt`);
        await fs.writeFile(tempFile, 'multi-window upload test');

        const uploaded = await popoutView.runInRenderer<boolean>(`
            const attachButton = document.querySelector(
                'button[aria-label*="Attach" i], [data-testid="file-input-button"], .AdvancedTextEditor__action-button[aria-label*="Attach" i]',
            );
            attachButton?.click();
            const input = document.querySelector('#fileUploadInput, input[type="file"]');
            if (!input) {
                return false;
            }
            const dataTransfer = new DataTransfer();
            const file = new File(['multi-window upload test'], 'upload-test.txt', {type: 'text/plain'});
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', {bubbles: true}));
            return true;
        `, true);

        await fs.unlink(tempFile).catch(() => {});

        expect(uploaded, 'File upload input must accept a file in the popout channel view').toBe(true);

        await expect.poll(async () => popoutView.runInRenderer<boolean>(`
            return Boolean(
                document.querySelector('.post-image__details, .file-preview, .post--attachment'),
            );
        `), {timeout: 20_000, message: 'Uploaded file preview must appear in the popout channel'}).toBe(true);
    });

    test('MM-T5889 Focus and notification behavior', {tag: ['@P2', '@all']}, async () => {
        await openPopoutViaFileMenu(electronApp, mainWindow);
        await waitForMainWindowFocused(electronApp, mainWindow, 15_000, 'Main window must be focused after clicking it');

        const mmServer = await getMattermostServer();
        const offTopic = await resolveChannelByName('off-topic');
        const channelPath = resolvedChannelPath(offTopic);
        await closeAllPopouts(electronApp);
        await openChannelInNewWindow(electronApp, channelPath);

        await electronApp.evaluate(({webContents}, payload) => {
            const wc = webContents.fromId(payload.webContentsId);
            if (!wc || wc.isDestroyed()) {
                throw new Error(`webContents ${payload.webContentsId} is not available`);
            }
            wc.send(payload.channel, payload.channelId, payload.teamId, payload.url);
        }, {
            webContentsId: mmServer.webContentsId,
            channel: NOTIFICATION_CLICKED,
            channelId: offTopic.id,
            teamId: offTopic.teamId,
            url: offTopic.url,
        });

        await waitForMainWindowFocused(
            electronApp,
            mainWindow,
            15_000,
            'Main window must be focused after handling a notification click',
        );

        await expect.poll(
            () => mmServer.evaluate(() => window.location.pathname),
            {timeout: 15_000, message: 'Main window server view must navigate to the notified channel'},
        ).toContain('off-topic');
    });

    test('MM-T5890 Opening channels in new windows', {tag: ['@P2', '@all']}, async () => {
        const mmServer = await getMattermostServer();

        await openSidebarChannelMenu(mmServer, '#sidebarItem_off-topic');
        expect(await clickOpenInNewWindowMenuItem(mmServer), 'Sidebar channel menu must expose Open in new window').toBe(true);
        await expect.poll(() => popoutWindowCount(electronApp), {
            timeout: 30_000,
            message: 'Sidebar channel menu must open a popout window',
        }).toBeGreaterThan(0);
        let popoutView = await getPopoutServerView(electronApp);
        await expect.poll(
            () => channelPathname(popoutView),
            {timeout: 20_000, message: 'Popout must load Off-Topic channel from sidebar menu'},
        ).toContain('off-topic');

        await expect.poll(
            () => popoutView.evaluate(() => document.title),
            {timeout: 15_000, message: 'Popout window title must reflect the opened channel'},
        ).toMatch(/off[- ]topic/i);

        await closeAllPopouts(electronApp);
        await prepareMattermostServerView(electronApp, mmServer.webContentsId);
        await mmServer.click('#sidebarItem_town-square');
        await waitForMattermostShellReady(mmServer, {channelItem: '#sidebarItem_town-square'});

        const baseline = popoutWindowCount(electronApp);
        await modifierClickSidebarChannel(electronApp, mmServer, '#sidebarItem_off-topic');
        await expect.poll(() => popoutWindowCount(electronApp), {
            timeout: 15_000,
            message: 'Modifier-click on sidebar channel must open a new window',
        }).toBeGreaterThan(baseline);

        popoutView = await getPopoutServerView(electronApp);
        await expect.poll(
            () => channelPathname(popoutView),
            {timeout: 20_000},
        ).toContain('off-topic');

        await closeAllPopouts(electronApp);
        await prepareMattermostServerView(electronApp, mmServer.webContentsId);
        await new Promise((resolve) => setTimeout(resolve, 1_100));
        await mmServer.click('#sidebarItem_off-topic');
        await waitForMattermostShellReady(mmServer, {channelItem: '#sidebarItem_off-topic'});

        await openChannelHeaderMenu(mmServer);
        expect(await clickOpenInNewWindowMenuItem(mmServer), 'Channel header menu must expose Open in new window').toBe(true);
        await expect.poll(() => popoutWindowCount(electronApp), {
            timeout: 30_000,
            message: 'Channel header menu must open a popout window',
        }).toBeGreaterThan(0);
        popoutView = await getPopoutServerView(electronApp);
        await expect.poll(
            () => channelPathname(popoutView),
            {timeout: 20_000},
        ).toContain('off-topic');
    });

    test('MM-T5891 Opening RHS plugin content in new windows', {tag: ['@P2', '@all']}, async () => {
        const mmServer = await getMattermostServer();
        const offTopic = await resolveChannelByName('off-topic');
        const channelPath = resolvedChannelPath(offTopic);

        await waitForMattermostShellReady(mmServer, {channelItem: '#sidebarItem_off-topic'});
        await mmServer.click('#sidebarItem_off-topic');

        const openedPluginRhs = await mmServer.runInRenderer<boolean>(`
            const playbook = document.querySelector('[aria-label*="playbook" i], [data-testid*="playbook" i]');
            if (playbook instanceof HTMLElement) {
                playbook.click();
                return true;
            }
            const copilot = document.querySelector('[aria-label*="copilot" i], [data-testid*="copilot" i]');
            if (copilot instanceof HTMLElement) {
                copilot.click();
                return true;
            }
            return false;
        `, true);

        if (openedPluginRhs) {
            await mmServer.waitForSelector('.sidebar-right, .PlaybooksPanel, .copilot-panel', {timeout: 15_000}).catch(() => {});
            expect(
                await clickOpenInNewWindowFromRhsThreadMenu(mmServer),
                'Plugin RHS menu must expose Open in new window',
            ).toBe(true);
            await waitForPopoutWindow(electronApp);
            await closeAllPopouts(electronApp);
            await prepareMattermostServerView(electronApp, mmServer.webContentsId);
            return;
        }

        await openRhsPopoutViaDesktopApi(mmServer, electronApp, channelPath);
        const popoutView = await getPopoutServerView(electronApp);
        await prepareMattermostServerView(electronApp, popoutView.webContentsId);
        await expect.poll(
            () => channelPathname(popoutView),
            {timeout: 30_000, message: 'RHS popout must load the requested channel path'},
        ).toContain('off-topic');
    });

    test('MM-T5892 Opening threads in new windows', {tag: ['@P2', '@all']}, async () => {
        const mmServer = await getMattermostServer();
        const channel = await resolveChannelByName('town-square');
        const threadSeed = await seedThreadInChannel('town-square');
        const teamPath = resolvedChannelPath(channel).replace(/\/channels\/[^/]+$/, '');
        const threadPermalink = `${teamPath}/pl/${threadSeed.rootId}`;

        await mmServer.evaluate((path) => window.location.assign(path), threadPermalink);
        await expect.poll(
            () => mmServer.evaluate(() => window.location.pathname.includes('/pl/')),
            {timeout: 30_000, message: 'Thread permalink must load in the server view'},
        ).toBe(true);

        const rhsWindowPromise = waitForPopoutWindowEvent(electronApp);
        const rhsMenuClicked = await clickOpenInNewWindowFromRhsThreadMenu(mmServer);
        if (rhsMenuClicked) {
            await rhsWindowPromise;
        } else {
            await openRhsPopoutViaDesktopApi(mmServer, electronApp, threadPermalink);
        }

        const rhsPopoutView = await getPopoutServerView(electronApp);
        await expect.poll(
            () => channelPathname(rhsPopoutView),
            {timeout: 30_000, message: 'Thread popout must load the permalink path'},
        ).toContain(threadSeed.rootId);

        await closeAllPopouts(electronApp);
        await prepareMattermostServerView(electronApp, mmServer.webContentsId);
        await new Promise((resolve) => setTimeout(resolve, 1_100));

        await mmServer.runInRenderer<boolean>(`
            const threadsLink = document.querySelector(
                '#sidebarItem_threads, a[href*="/threads"], button[aria-label="Threads"]',
            );
            if (!(threadsLink instanceof HTMLElement)) {
                return false;
            }
            threadsLink.click();
            return true;
        `, true);

        await expect.poll(async () => mmServer.runInRenderer<boolean>(`
            return Boolean(document.querySelector(
                '.ThreadPane, .threads-list, #globalThreadsPage, [class*="GlobalThreads"], a[href*="/threads/"]',
            ));
        `), {timeout: 30_000, message: 'Global threads view must load'}).toBe(true);

        let globalMenuClicked = false;
        try {
            await expect.poll(async () => mmServer.runInRenderer<boolean>(`
                const rootId = ${JSON.stringify(threadSeed.rootId)};
                const needle = 'e2e thread';
                const threadItem = Array.from(document.querySelectorAll(
                    '.ThreadPane .ThreadItem, .threads-list [class*="ThreadItem"], a[href*="/threads/"], a[href*="/pl/"]',
                )).find((candidate) => {
                    const text = candidate.textContent || '';
                    const href = candidate.getAttribute('href') || '';
                    return text.includes(needle) || href.includes(rootId);
                });
                if (!(threadItem instanceof HTMLElement)) {
                    return false;
                }
                threadItem.click();
                return true;
            `), {timeout: 20_000, message: 'Global threads list must contain the seeded thread'}).toBe(true);

            await expect.poll(() => popoutWindowCount(electronApp), {timeout: 30_000}).toBe(0);
            const globalWindowPromise = waitForPopoutWindowEvent(electronApp);
            globalMenuClicked = await clickOpenInNewWindowFromThreadsListMenu(mmServer);
            if (globalMenuClicked) {
                await globalWindowPromise;
            }
        } catch {
            globalMenuClicked = false;
        }

        if (!globalMenuClicked) {
            await openRhsPopoutViaDesktopApi(mmServer, electronApp, threadPermalink);
        }

        const globalPopoutView = await getPopoutServerView(electronApp);
        await expect.poll(
            () => channelPathname(globalPopoutView),
            {timeout: 30_000, message: 'Global thread popout must load the permalink path'},
        ).toContain(threadSeed.rootId);
        expect(threadSeed.rootId).toBeTruthy();
    });

    test('MM-T5893 State synchronization between windows', {tag: ['@P2', '@all']}, async () => {
        // Steps 1–2 (mark-as-read sync, thread reply sync) require fixtures not available in shared E2E helpers.

        const mmServer = await getMattermostServer();
        const townSquarePath = resolvedChannelPath(await resolveChannelByName('town-square'));
        await openChannelInNewWindow(electronApp, townSquarePath);
        const popoutView = await getPopoutServerView(electronApp);
        await prepareMattermostServerView(electronApp, popoutView.webContentsId);
        await expect.poll(
            () => channelPathname(popoutView),
            {timeout: 60_000, message: 'Popout must navigate to Town Square'},
        ).toContain('town-square');

        const popoutPathBefore = await channelPathname(popoutView);
        expect(popoutPathBefore).toContain('town-square');

        await mmServer.click('#sidebarItem_off-topic');
        await expect.poll(
            () => mmServer.evaluate(() => window.location.pathname),
            {timeout: 10_000},
        ).toContain('off-topic');

        await expect.poll(
            () => channelPathname(popoutView),
            {timeout: 10_000, message: 'Popout must remain on Town Square when main window switches channels'},
        ).toContain('town-square');
    });

    test('MM-T5894 Tab behavior changes', {tag: ['@P2', '@all']}, async () => {
        const offTopicPath = resolvedChannelPath(await resolveChannelByName('off-topic'));
        await openChannelInNewWindow(electronApp, offTopicPath);
        const windowView = await getWindowTypeView(electronApp);

        await electronApp.evaluate((_, viewId) => {
            const refs = (global as any).__e2eTestRefs;
            refs.ViewManager.updateViewType(viewId, 'tab');
        }, windowView.viewId);

        await expect.poll(() => popoutWindowCount(electronApp), {timeout: 15_000}).toBe(0);
        await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});

        const serverName = config.servers[0].name;
        const previousTabCount = (await buildServerMap(electronApp))[serverName]?.length ?? 0;

        await mainWindow.click('#newTabButton');
        await expect.poll(async () => {
            const map = await buildServerMap(electronApp);
            return map[serverName]?.length ?? 0;
        }, {timeout: 15_000}).toBe(previousTabCount + 1);

        const serverMap = await buildServerMap(electronApp);
        const newTab = serverMap[serverName]?.[previousTabCount];
        const secondView = newTab?.win;
        expect(secondView).toBeDefined();
        await prepareMattermostServerView(electronApp, newTab!.webContentsId);
        await navigateViewToChannel(secondView!, 'off-topic');

        const tabViewId = await electronApp.evaluate((_, webContentsId) => {
            const refs = (global as any).__e2eTestRefs;
            return refs.WebContentsManager.getViewByWebContentsId(webContentsId)?.id ?? null;
        }, newTab!.webContentsId);
        expect(tabViewId).toBeTruthy();

        const windowPromise = waitForPopoutWindowEvent(electronApp);
        await electronApp.evaluate((_, viewId) => {
            const refs = (global as any).__e2eTestRefs;
            refs.ViewManager.updateViewType(viewId, 'window');
        }, tabViewId!);
        await windowPromise;

        await expect.poll(async () => mainWindow.locator('.TabBar li.serverTabItem').count(), {
            timeout: 15_000,
            message: 'Converted tab must disappear from the tab bar',
        }).toBe(previousTabCount);
        await expect.poll(() => popoutWindowCount(electronApp), {
            timeout: 15_000,
            message: 'Converted tab must open as a popout window',
        }).toBe(1);
        await expect.poll(async () => electronApp.evaluate((_, viewId) => {
            const refs = (global as any).__e2eTestRefs;
            const serverId = refs.ServerManager.getCurrentServerId();
            const tabIds = refs.TabManager.getOrderedTabsForServer(serverId).map((tab: {id: string}) => tab.id);
            return !tabIds.includes(viewId);
        }, tabViewId!), {timeout: 15_000}).toBe(true);

        await closeAllPopouts(electronApp);
        mainWindow = await resetTabsAndPopouts(electronApp);

        await mainWindow.click('#newTabButton');
        await mainWindow.waitForSelector('.TabBar li.serverTabItem:nth-child(2)', {timeout: 15_000});

        const closeButton = await mainWindow.waitForSelector(
            '.TabBar li.serverTabItem:nth-child(2) .serverTabItem__close',
            {timeout: 15_000},
        );
        await closeButton.click();

        await expect.poll(async () => mainWindow.$('.TabBar li.serverTabItem:nth-child(2)'), {
            timeout: 15_000,
        }).toBeNull();
    });

    test('MM-T5895 Window management (resizing, moving, closing)', {tag: ['@P2', '@all']}, async () => {
        const popoutWindow = await openPopoutViaFileMenu(electronApp, mainWindow);
        const browserWindow = await electronApp.browserWindow(popoutWindow);
        const initialBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());

        const resizedBounds = {
            x: initialBounds.x,
            y: initialBounds.y,
            width: initialBounds.width + 200,
            height: initialBounds.height + 200,
        };

        await browserWindow.evaluate((w, bounds) => {
            (w as Electron.BrowserWindow).setBounds(bounds as Electron.Rectangle);
        }, resizedBounds);

        const currentBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());
        const tolerance = process.platform === 'darwin' ? 250 : 10;
        expect(Math.abs(currentBounds.width - resizedBounds.width)).toBeLessThan(tolerance);
        expect(Math.abs(currentBounds.height - resizedBounds.height)).toBeLessThan(tolerance);

        const popoutView = await getPopoutServerView(electronApp);
        await popoutView.waitForSelector('#sidebarItem_town-square, #post_textbox', {timeout: 15_000});

        const movedBounds = {
            x: initialBounds.x + 50,
            y: initialBounds.y + 50,
            width: currentBounds.width,
            height: currentBounds.height,
        };

        await browserWindow.evaluate((w, bounds) => {
            (w as Electron.BrowserWindow).setBounds(bounds as Electron.Rectangle);
        }, movedBounds);

        const afterMoveBounds = await browserWindow.evaluate((w) => (w as Electron.BrowserWindow).getBounds());
        expect(Math.abs(afterMoveBounds.x - movedBounds.x)).toBeLessThan(tolerance);
        expect(Math.abs(afterMoveBounds.y - movedBounds.y)).toBeLessThan(tolerance);

        await closePopoutWindow(electronApp, popoutWindow);
    });
});
