// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {findCallsWidgetWindow, startCall, closeCallsWidget, leaveCallIfActive} from '../../helpers/callsWidget';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {apiLogin} from '../../helpers/server_api/client';
import {ensureCallsPlugin} from '../../helpers/server_api/plugin';
import type {ServerView} from '../../helpers/serverView';

async function sendSlashCommand(serverWin: ServerView, command: string): Promise<void> {
    await serverWin.type('#post_textbox', command);
    await serverWin.click('[data-testid="SendMessageButton"]');
}

test.describe('calls/slash_commands', () => {
    test.use({appConfig: demoMattermostConfig});
    test.describe.configure({mode: 'serial'});
    test.setTimeout(120_000);

    let serverWin: ServerView;

    test.beforeAll(async () => {
        const serverUrl = process.env.MM_TEST_SERVER_URL;
        const username = process.env.MM_TEST_USER_NAME;
        const password = process.env.MM_TEST_PASSWORD;
        if (!serverUrl || !username || !password) {
            return;
        }
        const token = await apiLogin(serverUrl, username, password).catch(() => null);
        if (!token) {
            return;
        }
        await ensureCallsPlugin(serverUrl, token).catch(() => null);
    });

    test.beforeEach(async ({serverMap, electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        expect(serverEntry, 'Mattermost server view should exist').toBeTruthy();
        serverWin = serverEntry!.win;

        await loginToMattermost(serverWin);
        await serverWin.waitForSelector('#sidebarItem_town-square', {timeout: 15_000});
        await serverWin.click('#sidebarItem_town-square');
        await serverWin.waitForSelector('#channelHeaderTitle', {timeout: 10_000});
        await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
        await leaveCallIfActive(electronApp);
    });

    test(
        'MM-T5588 /call end — host ends the call',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin).catch(() => null);
            if (!widgetWindow) {
                test.skip(true, 'Calls plugin/widget not available on this test server');
                return;
            }

            // Wait for background WebRTC ICE exchange to finish consuming Calls plugin
            // rate limiter tokens (burst=10, 1/sec refill). ICE continues after the
            // widget appears; without this wait, /call end arrives while the bucket is
            // still at 0 and the server returns HTTP 429, silently swallowed by the
            // EndCallConfirmation modal.
            await new Promise((r) => setTimeout(r, 10_000));

            await sendSlashCommand(serverWin, '/call end');

            // /call end opens a confirmation modal — click "End call" to confirm.
            await serverWin.waitForSelector('#end_call_confirmation', {timeout: 10_000});
            await serverWin.click('[data-testid="modal-confirm-button"]');

            await expect.poll(
                () => findCallsWidgetWindow(electronApp),
                {timeout: 30_000, message: 'Calls widget must close after /call end'},
            ).toBeNull();

            const toastVisible = await serverWin.isVisible('#calls-channel-toast');
            expect(toastVisible, '#calls-channel-toast must not be visible after call ends').toBe(false);

            const activeCallIconVisible = await serverWin.isVisible('[data-testid="calls-sidebar-active-call-icon"]');
            expect(activeCallIconVisible, 'Sidebar active call icon must not be visible after call ends').toBe(false);
        },
    );

    test(
        'MM-T5589 /call stats — returns call statistics',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin).catch(() => null);
            if (!widgetWindow) {
                test.skip(true, 'Calls plugin/widget not available on this test server');
                return;
            }

            await closeCallsWidget(electronApp, widgetWindow);
            await sendSlashCommand(serverWin, '/call stats');

            // /call stats posts an ephemeral response with the stats JSON.
            // CallsClientStats keys: initTime, channelID, tracksInfo, rtcStats.
            // Use :has-text() to find the post by content, independent of class or position.
            await expect.poll(
                async () => serverWin.locator(".post__body:has-text('initTime')").last().textContent(),
                {timeout: 15_000, message: '/call stats must post a response containing call statistics'},
            ).toContain('initTime');

            const text = await serverWin.locator(".post__body:has-text('channelID')").last().textContent();
            expect(text).toContain('channelID');
        },
    );

    test(
        'MM-T5590 /call logs — returns call log output',
        {tag: ['@P1', '@all']},
        async () => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            // No call start here — this suite is serial so T5588/T5589 already
            // confirmed plugin availability. Starting a call would consume rate
            // limiter tokens immediately before /logs/upload hits the same limiter.
            // T5589 also left call logs in localStorage from its own call.
            await serverWin.runInRenderer<void>(`
                if (!(localStorage.getItem('calls_client_logs') || '').trim()) {
                    localStorage.setItem('calls_client_logs',
                        'debug [e2e] pre-seeded call log for MM-T5590\\n',
                    );
                }
            `);

            await sendSlashCommand(serverWin, '/call logs');

            // /call logs uploads a log file to the @calls DM and posts an ephemeral
            // confirmation in the current channel. Use :has-text() to find the post
            // by content — the log text itself is in a file attachment in the DM.
            await expect.poll(
                async () => serverWin.locator(".post__body:has-text('Call logs uploaded')").last().textContent(),
                {timeout: 15_000, message: '/call logs must post a response confirming log upload'},
            ).toContain('Call logs uploaded');
        },
    );
});
