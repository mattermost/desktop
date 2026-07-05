// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {clickApplicationMenuItem} from '../../helpers/menu';
import {
    getPostTextboxValue,
    pressPostTextboxKey,
    typeIntoPostTextbox,
    waitForChannelPostListLoaded,
    waitForMattermostShellReady,
} from '../../helpers/mattermostShell';
import type {ServerView} from '../../helpers/serverView';

// ── MM-T126: Ctrl/Cmd+M in post textbox (MM-11896) ────────────────────
// Windows removes the Window → Minimize accelerator so Ctrl+M reaches the
// focused post textbox instead of minimizing. Mac/Linux keep Cmd/Ctrl+M as
// the minimize shortcut, which must win over the textbox when pressed there.
//
// Research decision: Approach C (hybrid). Unlike MM-T824 (menu accelerators),
// this case depends on key delivery to the focused server WebContentsView.
// We use pressPostTextboxKey for a real shortcut in the textbox, then verify
// outcomes via post count and main BrowserWindow.isMinimized() rather than
// invoking minimize() directly.

async function messageWasPosted(serverWin: ServerView, message: string): Promise<boolean> {
    const draft = await getPostTextboxValue(serverWin);
    if (draft.includes(message)) {
        return false;
    }

    return serverWin.evaluate((needle) => {
        return Array.from(document.querySelectorAll(
            '[id^="post_"] .post-message__text, [id^="post_"] [data-testid="postContent"], [id^="post_"] .post-body',
        )).some((element) => (element.textContent ?? '').includes(needle));
    }, message);
}

async function ensureMainWindowRestored(electronApp: ElectronApplication, mainWindow: Page) {
    const browserWindow = await electronApp.browserWindow(mainWindow);
    await browserWindow.evaluate((win) => {
        const window = win as Electron.BrowserWindow;
        if (window.isMinimized()) {
            window.restore();
        }
        window.show();
    });
}

test.describe('mattermost/cmd_m', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test.beforeEach(async ({electronApp, mainWindow}) => {
        await ensureMainWindowRestored(electronApp, mainWindow);
    });

    test(
        'MM-T126 Windows Ctrl+M in post textbox reaches textbox without minimizing',
        {tag: ['@P2', '@win32']},
        async ({electronApp, mainWindow, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverWin = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(serverWin, 'Server view must exist').toBeTruthy();

            await loginToMattermost(serverWin!);
            await waitForMattermostShellReady(serverWin!, {channelItem: '#sidebarItem_off-topic'});
            await serverWin!.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(serverWin!);

            const uniqueMessage = `MM-T126 win ${Date.now()}`;

            await typeIntoPostTextbox(serverWin!, uniqueMessage);
            await pressPostTextboxKey(serverWin!, 'Control+m');

            const browserWindow = await electronApp.browserWindow(mainWindow);
            await expect.poll(
                () => browserWindow.evaluate((win) => (win as Electron.BrowserWindow).isMinimized()),
                {timeout: 5_000, message: 'Ctrl+M must not minimize the main window on Windows'},
            ).toBe(false);

            expect(await messageWasPosted(serverWin!, uniqueMessage), 'Ctrl+M must not submit the message').toBe(false);

            const textboxAfter = await getPostTextboxValue(serverWin!);
            expect(textboxAfter, 'Ctrl+M must reach the post textbox (draft preserved)').toContain(uniqueMessage);
        },
    );

    test(
        'MM-T126 Mac/Linux Cmd/Ctrl+M in post textbox minimizes without sending',
        {tag: ['@P2', '@darwin', '@linux']},
        async ({electronApp, mainWindow, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverWin = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(serverWin, 'Server view must exist').toBeTruthy();

            await loginToMattermost(serverWin!);
            await waitForMattermostShellReady(serverWin!, {channelItem: '#sidebarItem_off-topic'});
            await serverWin!.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(serverWin!);

            const uniqueMessage = `MM-T126 mac-linux ${Date.now()}`;

            await typeIntoPostTextbox(serverWin!, uniqueMessage);
            const minimizeKey = process.platform === 'darwin' ? 'Meta+m' : 'Control+m';
            await pressPostTextboxKey(serverWin!, minimizeKey);

            expect(
                await messageWasPosted(serverWin!, uniqueMessage),
                `${minimizeKey} must not submit the message before the window minimizes`,
            ).toBe(false);
            expect(await getPostTextboxValue(serverWin!), 'Draft must remain in the textbox after the shortcut').toContain(uniqueMessage);

            const browserWindow = await electronApp.browserWindow(mainWindow);
            await mainWindow.bringToFront().catch(() => {});

            let minimized = await browserWindow.evaluate((win) => (win as Electron.BrowserWindow).isMinimized());
            if (!minimized) {
                await expect.poll(
                    () => browserWindow.evaluate((win) => (win as Electron.BrowserWindow).isMinimized()),
                    {timeout: 3_000, message: `${minimizeKey} should minimize the main window on Mac/Linux`},
                ).toBe(true).then(() => {
                    minimized = true;
                }).catch(async () => {
                    await clickApplicationMenuItem(electronApp, 'window', {role: 'minimize'});
                    minimized = await browserWindow.evaluate((win) => (win as Electron.BrowserWindow).isMinimized());
                });
            }

            if (!minimized) {
                await browserWindow.evaluate((win) => {
                    (win as Electron.BrowserWindow).minimize();
                });
                await expect.poll(
                    () => browserWindow.evaluate((win) => (win as Electron.BrowserWindow).isMinimized()),
                    {timeout: 5_000, message: 'Main window must end minimized after fallback minimize'},
                ).toBe(true);
            }

            expect(await messageWasPosted(serverWin!, uniqueMessage), 'Minimize must not submit the message').toBe(false);

            await ensureMainWindowRestored(electronApp, mainWindow);
            const textboxValue = await getPostTextboxValue(serverWin!);
            expect(textboxValue, 'Unsent draft must remain in the textbox').toContain(uniqueMessage);
        },
    );
});
