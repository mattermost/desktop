// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {findCallsWidgetWindow, startCall, closeCallsWidget, sendWidgetShortcut, leaveCallIfActive} from '../../helpers/callsWidget';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost, logoutFromMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {apiLogin} from '../../helpers/server_api/client';
import {ensureCallsPlugin} from '../../helpers/server_api/plugin';
import {apiGetAdminTeamId, createCallsTestUser, type TestUser} from '../../helpers/server_api/user';
import type {ServerView} from '../../helpers/serverView';

test.describe('calls/keyboard_shortcuts', () => {
    test.use({appConfig: demoMattermostConfig});
    test.describe.configure({mode: 'serial'});
    test.setTimeout(120_000);

    let serverWin: ServerView;
    let adminToken: string;
    let teamId: string;
    let testServerUrl: string;

    test.beforeAll(async () => {
        const serverUrl = process.env.MM_TEST_SERVER_URL;
        const username = process.env.MM_TEST_USER_NAME;
        const password = process.env.MM_TEST_PASSWORD;
        if (!serverUrl || !username || !password) {
            return;
        }
        testServerUrl = serverUrl;
        adminToken = await apiLogin(serverUrl, username, password);
        await ensureCallsPlugin(serverUrl, adminToken);
        teamId = await apiGetAdminTeamId(serverUrl, adminToken);
    });

    test.beforeEach(async ({serverMap, electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL || !adminToken || !teamId) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        expect(serverEntry, 'Mattermost server view should exist').toBeTruthy();
        serverWin = serverEntry!.win;

        await logoutFromMattermost(serverWin);
        const testUser: TestUser = await createCallsTestUser(testServerUrl, adminToken, teamId);
        await loginToMattermost(serverWin, testUser);
        await serverWin.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
        await serverWin.click('#sidebarItem_town-square');
        await serverWin.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
        await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
        await leaveCallIfActive(electronApp);
    });

    // Covered by MM-T5411 in calls_functionality.test.ts (smoke test). Skip here to avoid duplicate coverage.
    test.skip('MM Calls - Mute/Unmute keyboard shortcut (Cmd/Ctrl+Shift+Space)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);
            await widgetWindow.bringToFront();

            const initialLabel = await widgetWindow.evaluate(() => {
                return document.querySelector('#voice-mute-unmute')?.getAttribute('aria-label') ?? null;
            });

            const isMac = process.platform === 'darwin';
            await sendWidgetShortcut(electronApp, 'Space', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    return document.querySelector('#voice-mute-unmute')?.getAttribute('aria-label') ?? null;
                }),
                {timeout: 5_000, message: 'Mute button aria-label must toggle after Cmd/Ctrl+Shift+Space'},
            ).not.toBe(initialLabel);

            await closeCallsWidget(electronApp, widgetWindow, serverWin);
        },
    );

    test('MM Calls - Raise/Lower hand keyboard shortcut (Cmd/Ctrl+Shift+Y)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);
            await widgetWindow.bringToFront();

            // Verify hand starts lowered
            const initialLabel = await widgetWindow.evaluate(() => {
                return document.querySelector('#raise-hand')?.getAttribute('aria-label') ?? null;
            });
            expect(initialLabel).toContain('Raise hand');

            const isMac = process.platform === 'darwin';
            await sendWidgetShortcut(electronApp, 'Y', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            // Hand raised — aria-label switches to "Lower hand"
            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    return document.querySelector('#raise-hand')?.getAttribute('aria-label') ?? null;
                }),
                {timeout: 5_000, message: 'Raise hand button aria-label must change to "Lower hand" after shortcut'},
            ).toContain('Lower hand');

            // Press again to lower
            await sendWidgetShortcut(electronApp, 'Y', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    return document.querySelector('#raise-hand')?.getAttribute('aria-label') ?? null;
                }),
                {timeout: 5_000, message: 'Raise hand button aria-label must revert to "Raise hand" after second shortcut'},
            ).toContain('Raise hand');

            await closeCallsWidget(electronApp, widgetWindow, serverWin);
        },
    );

    test('MM Calls - Participants list keyboard shortcut (Cmd/Ctrl+Shift+P)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);
            await widgetWindow.bringToFront();

            // Participants list starts hidden
            const initiallyHidden = await widgetWindow.evaluate(() => {
                return document.querySelector('#calls-widget-participants-menu') === null ||
                    (document.querySelector('#calls-widget-participants-menu') as HTMLElement).style.display === 'none';
            });
            expect(initiallyHidden, 'Participants list must be hidden before shortcut').toBe(true);

            const isMac = process.platform === 'darwin';
            await sendWidgetShortcut(electronApp, 'P', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            // Participants list appears
            await widgetWindow.waitForSelector('#calls-widget-participants-menu', {timeout: 5_000});
            const participantsList = await widgetWindow.evaluate(() => {
                return document.querySelector('#calls-widget-participants-menu') !== null;
            });
            expect(participantsList, 'Participants list must be visible after shortcut').toBe(true);

            // Button aria-expanded reflects open state
            const expanded = await widgetWindow.evaluate(() => {
                return document.querySelector('#calls-widget-participants-button')?.getAttribute('aria-expanded') ?? null;
            });
            expect(expanded).toBe('true');

            // Press again to close
            await sendWidgetShortcut(electronApp, 'P', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    return document.querySelector('#calls-widget-participants-button')?.getAttribute('aria-expanded') ?? null;
                }),
                {timeout: 5_000, message: 'Participants button aria-expanded must be false after closing shortcut'},
            ).toBe('false');

            await closeCallsWidget(electronApp, widgetWindow, serverWin);
        },
    );

    test('MM Calls - Screen share keyboard shortcut triggers Desktop API (Cmd/Ctrl+Shift+E)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);
            await widgetWindow.bringToFront();

            // desktopAPI is exposed via contextBridge and is a frozen proxy — we cannot
            // spy on it from the renderer. Instead, listen for the IPC message on the
            // main process side, which is what desktopAPI.openScreenShareModal() sends.
            await electronApp.evaluate(({ipcMain}) => {
                (global as unknown as Record<string, unknown>).__screenShareIPCReceived = false;
                ipcMain.once('desktop-sources-modal-request', () => {
                    (global as unknown as Record<string, unknown>).__screenShareIPCReceived = true;
                });
            });

            const isMac = process.platform === 'darwin';
            await sendWidgetShortcut(electronApp, 'E', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            await expect.poll(
                () => electronApp.evaluate(() => (global as unknown as Record<string, unknown>).__screenShareIPCReceived),
                {timeout: 5_000, message: 'Cmd/Ctrl+Shift+E must send desktop-sources-modal-request IPC from widget'},
            ).toBe(true);

            await closeCallsWidget(electronApp, widgetWindow, serverWin);
        },
    );

    test('MM Calls - Leave call keyboard shortcut (Cmd/Ctrl+Shift+L)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);
            await widgetWindow.bringToFront();

            const isMac = process.platform === 'darwin';
            await sendWidgetShortcut(electronApp, 'L', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            // Leave call (Cmd/Ctrl+Shift+L) calls disconnect() directly — no confirmation modal.
            await expect.poll(
                () => findCallsWidgetWindow(electronApp),
                {timeout: 10_000, message: 'Calls widget must close after Cmd/Ctrl+Shift+L'},
            ).toBeNull();

            await expect.poll(
                () => serverWin.isVisible('[data-testid="calls-sidebar-active-call-icon"]'),
                {timeout: 10_000, message: 'Sidebar active call icon must not be visible after leaving'},
            ).toBe(false);
        },
    );
});
