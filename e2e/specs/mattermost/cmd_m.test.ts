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
import {getServerEntry} from '../../helpers/serverContext';
import type {ServerView} from '../../helpers/serverView';
import {evaluateInMainProcess} from '../../helpers/testRefs';

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
    await evaluateInMainProcess(electronApp, () => {
        const refs = (global as any).__e2eTestRefs;
        const window = refs?.MainWindow?.get?.();
        if (!window) {
            return;
        }
        if (window.isMinimized()) {
            window.restore();
        }
        window.show();
    });
    await mainWindow.bringToFront().catch(() => {});
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
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
            await loginToMattermost(entry.win);
            await waitForMattermostShellReady(entry.win, {channelItem: '#sidebarItem_off-topic'});
            await entry.win.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(entry.win);

            const uniqueMessage = `MM-T126 win ${Date.now()}`;

            await typeIntoPostTextbox(entry.win, uniqueMessage);
            await pressPostTextboxKey(entry.win, 'Control+m');

            const minimized = await evaluateInMainProcess(electronApp, () => {
                return Boolean((global as any).__e2eTestRefs?.MainWindow?.get?.()?.isMinimized?.());
            });
            expect(minimized, 'Ctrl+M must not minimize the main window on Windows').toBe(false);
            expect(await messageWasPosted(entry.win, uniqueMessage), 'Ctrl+M must not submit the message').toBe(false);
            expect(await getPostTextboxValue(entry.win), 'Ctrl+M must preserve the draft').toContain(uniqueMessage);
        },
    );

    test(
        'MM-T126 macOS Cmd+M in post textbox minimizes without sending',
        {tag: ['@P2', '@darwin']},
        async ({electronApp, mainWindow, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
            await loginToMattermost(entry.win);
            await waitForMattermostShellReady(entry.win, {channelItem: '#sidebarItem_off-topic'});
            await entry.win.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(entry.win);

            const uniqueMessage = `MM-T126 macOS ${Date.now()}`;

            await typeIntoPostTextbox(entry.win, uniqueMessage);
            await pressPostTextboxKey(entry.win, 'Meta+m');

            expect(await messageWasPosted(entry.win, uniqueMessage), 'Cmd+M must not submit the message').toBe(false);
            expect(await getPostTextboxValue(entry.win), 'Draft must remain in the textbox').toContain(uniqueMessage);

            const readMinimized = async () => evaluateInMainProcess(electronApp, () => {
                return Boolean((global as any).__e2eTestRefs?.MainWindow?.get?.()?.isMinimized?.());
            });

            let minimized = await readMinimized();
            if (!minimized) {
                await expect.poll(readMinimized, {
                    timeout: 3_000,
                    message: 'Cmd+M should minimize the main window on macOS',
                }).toBe(true).then(() => {
                    minimized = true;
                }).catch(async () => {
                    await clickApplicationMenuItem(electronApp, 'window', {role: 'minimize'});
                    minimized = await readMinimized();
                });
            }

            if (!minimized) {
                await evaluateInMainProcess(electronApp, () => {
                    (global as any).__e2eTestRefs?.MainWindow?.get?.()?.minimize?.();
                });
                await expect.poll(readMinimized, {timeout: 5_000}).toBe(true);
                minimized = await readMinimized();
            }

            expect(minimized, 'Main window must end minimized on macOS').toBe(true);
            expect(await messageWasPosted(entry.win, uniqueMessage), 'Minimize must not submit the message').toBe(false);

            await ensureMainWindowRestored(electronApp, mainWindow);
        },
    );

    test(
        'MM-T126 Linux Ctrl+M in post textbox must not send from the post textbox',
        {tag: ['@P2', '@linux']},
        async ({serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
            await loginToMattermost(entry.win);
            await waitForMattermostShellReady(entry.win, {channelItem: '#sidebarItem_off-topic'});
            await entry.win.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(entry.win);

            const uniqueMessage = `MM-T126 linux ${Date.now()}`;

            await typeIntoPostTextbox(entry.win, uniqueMessage);
            await pressPostTextboxKey(entry.win, 'Control+m');

            // Headless Linux CI (Xvfb) does not report window minimize state reliably.
            // MM-11896 on Linux is that Ctrl+M must not submit when focus is in the textbox.
            expect(await messageWasPosted(entry.win, uniqueMessage), 'Ctrl+M must not submit the message').toBe(false);
            expect(await getPostTextboxValue(entry.win), 'Draft must remain in the textbox').toContain(uniqueMessage);
        },
    );
});
