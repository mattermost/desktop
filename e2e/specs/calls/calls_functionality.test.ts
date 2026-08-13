// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForCallsWidgetWindow, closeCallsWidget, sendWidgetShortcut, leaveCallIfActive, startCall} from '../../helpers/callsWidget';
import {waitForMattermostShellReady} from '../../helpers/channelReadiness';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost, logoutFromMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {apiLogin} from '../../helpers/server_api/client';
import {ensureCallsPlugin} from '../../helpers/server_api/plugin';
import {apiGetAdminTeamId, createCallsTestUser, type TestUser} from '../../helpers/server_api/user';
import type {ServerView} from '../../helpers/serverView';

test.describe('calls/calls_functionality', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
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
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        expect(serverEntry, 'Mattermost server view should exist').toBeTruthy();
        serverWin = serverEntry!.win;

        await logoutFromMattermost(serverWin);
        const testUser: TestUser = await createCallsTestUser(testServerUrl, adminToken, teamId);
        await loginToMattermost(serverWin, testUser);
        await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_town-square'});
        await serverWin.click('#sidebarItem_town-square');
        await serverWin.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
        await leaveCallIfActive(electronApp);
        await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
    });

    test('MM-T4841 Calls UI Functionality - Self-managed',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            await serverWin.type('#post_textbox', '/call start');

            // wc.insertText() leaves window.getSelection() outside the Slate
            // contenteditable so keyboard Enter is ignored. Click Send instead.
            await serverWin.click('[data-testid="SendMessageButton"]');

            const widgetWindow = await waitForCallsWidgetWindow(electronApp);
            if (!widgetWindow) {
                test.skip(true, 'Calls plugin/widget not available on this test server');
                return;
            }

            expect(widgetWindow.url(), 'Widget URL must point to Calls plugin').toContain(
                '/plugins/com.mattermost.calls/standalone/widget.html',
            );

            // Wait for mute button directly — covers React mount + call connection in one step.
            const muteButton = await widgetWindow.waitForSelector(
                'button[aria-label*="Mute"], button[aria-label*="mute"]',
                {timeout: 30_000},
            );
            expect(muteButton, 'Mute button must exist in Calls widget').toBeTruthy();

            // Widget uses aria-label toggling ("Mute" / "Unmute") — no aria-pressed.
            const initialLabel = await widgetWindow.evaluate(() => {
                return document.querySelector('#voice-mute-unmute')?.getAttribute('aria-label') ?? null;
            });

            await muteButton.click();

            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    return document.querySelector('#voice-mute-unmute')?.getAttribute('aria-label') ?? null;
                }),
                {timeout: 5_000, message: 'Mute button aria-label must toggle after click'},
            ).not.toBe(initialLabel);

            await closeCallsWidget(electronApp, widgetWindow);
        },
    );

    test('MM-T5587 Calls - Slash Commands',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);

            expect(widgetWindow.url(), '/call start must open Calls widget').toContain(
                '/plugins/com.mattermost.calls/standalone/widget.html',
            );

            await closeCallsWidget(electronApp, widgetWindow);
        },
    );

    test('MM-T5411 Calls - Keyboard Shortcuts (self-managed)',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
            await serverWin.type('#post_textbox', '/call start');
            await serverWin.click('[data-testid="SendMessageButton"]');

            const widgetWindow = await waitForCallsWidgetWindow(electronApp, 30_000);
            if (!widgetWindow) {
                test.skip(true, 'Calls plugin/widget not available on this test server');
                return;
            }

            // Wait for mute button directly — covers React mount + call connection in one step.
            await widgetWindow.waitForSelector('button[aria-label*="Mute"], button[aria-label*="mute"]', {timeout: 30_000});
            await widgetWindow.bringToFront();

            const initialLabel = await widgetWindow.evaluate(() => {
                return document.querySelector('#voice-mute-unmute')?.getAttribute('aria-label') ?? null;
            });

            // callsClient.unmute() silently bails when this.peer is null (no WebRTC connection yet).
            // The mute button can appear before the peer is established, so wait explicitly.
            await widgetWindow.waitForFunction(
                () => Boolean(((window as unknown as Record<string, unknown>).callsClient as Record<string, unknown> | undefined)?.peer),
                {timeout: 15_000},
            );

            const isMac = process.platform === 'darwin';
            await sendWidgetShortcut(electronApp, 'Space', isMac ? ['shift', 'meta'] : ['shift', 'control']);

            await expect.poll(
                () => widgetWindow.evaluate(() => {
                    return document.querySelector('#voice-mute-unmute')?.getAttribute('aria-label') ?? null;
                }),
                {timeout: 5_000, message: 'Mute button aria-label must toggle after pressing the mute keyboard shortcut'},
            ).not.toBe(initialLabel);

            await closeCallsWidget(electronApp, widgetWindow);
        },
    );
});

