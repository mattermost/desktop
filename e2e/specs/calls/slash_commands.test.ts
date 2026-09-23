// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {TestInfo} from '@playwright/test';

import {test, expect} from '../../fixtures/index';
import {assertCallsSpecsOnShard1} from '../../helpers/assertCallsShard';
import {closeCallsWidget, enterCallsTestChannel, findCallsWidgetWindow, leaveCallIfActive, startCall} from '../../helpers/callsWidget';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost, logoutFromMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {apiLogin, apiRequest} from '../../helpers/server_api/client';
import {apiGetAdminTeamId, archiveCallsTestChannels, createCallsTestChannel, createCallsTestUser, deactivateCallsTestUsers, type TestChannel, type TestUser} from '../../helpers/server_api/user';
import type {ServerView} from '../../helpers/serverView';

async function sendSlashCommand(serverWin: ServerView, command: string): Promise<void> {
    await serverWin.waitForSelector('#post_textbox', {timeout: 10_000});
    await serverWin.type('#post_textbox', command);
    await serverWin.click('[data-testid="SendMessageButton"]');
}

test.describe('calls/slash_commands', () => {
    test.use({appConfig: demoMattermostConfig, grantMediaPermissions: true});
    test.describe.configure({mode: 'serial'});
    test.setTimeout(120_000);

    // Suite-level, so Playwright never resolves the electronApp/serverMap fixtures
    // when the server env is absent. A guard inside beforeEach runs only AFTER those
    // fixtures are built, so an unconfigured run would launch Electron and fail on
    // the server view instead of reporting a clean skip.
    test.skip(
        !process.env.MM_TEST_SERVER_URL || !process.env.MM_TEST_USER_NAME || !process.env.MM_TEST_PASSWORD,
        'MM_TEST_SERVER_URL, MM_TEST_USER_NAME and MM_TEST_PASSWORD required',
    );

    let serverWin: ServerView;
    let adminToken: string;
    let teamId: string;
    let testServerUrl: string;
    let testChannel: TestChannel;

    test.beforeAll(async ({}, testInfo: TestInfo) => {
        assertCallsSpecsOnShard1(testInfo.config.shard);
        const serverUrl = process.env.MM_TEST_SERVER_URL;
        const username = process.env.MM_TEST_USER_NAME;
        const password = process.env.MM_TEST_PASSWORD;
        if (!serverUrl || !username || !password) {
            return;
        }
        testServerUrl = serverUrl;

        // The Calls plugin itself is installed, enabled and configured once per run in
        // global-setup.ts — never here. Doing it per-file restarts the plugin server-wide
        // while another worker may be mid-call. global-setup.ts also sets SiteURL, which
        // the /call logs endpoint needs to build DM links.
        adminToken = await apiLogin(serverUrl, username, password);
        teamId = await apiGetAdminTeamId(serverUrl, adminToken);
    });

    test.afterEach(async () => {
        if (testServerUrl && adminToken) {
            await archiveCallsTestChannels(testServerUrl, adminToken);
        }
    });

    test.afterAll(async () => {
        if (testServerUrl && adminToken) {
            await archiveCallsTestChannels(testServerUrl, adminToken);
            await deactivateCallsTestUsers(testServerUrl, adminToken);
        }
    });

    test.beforeEach(async ({serverMap, electronApp}) => {
        // Env is handled by the suite-level skip above; this only catches a
        // beforeAll that returned without provisioning.
        if (!adminToken || !teamId) {
            test.skip(true, 'Calls suite setup did not complete');
            return;
        }

        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        expect(serverEntry, 'Mattermost server view should exist').toBeTruthy();
        serverWin = serverEntry!.win;

        await logoutFromMattermost(serverWin);
        const testUser: TestUser = await createCallsTestUser(testServerUrl, adminToken, teamId);
        testChannel = await createCallsTestChannel(testServerUrl, teamId, testUser);
        await loginToMattermost(serverWin, testUser);
        await enterCallsTestChannel(serverWin, testChannel.name);
        await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
        await leaveCallIfActive(electronApp, serverWin);
    });

    // NOTE: this does NOT exercise the `/call end` slash command, despite MM-T5588's
    // wording. Sending `/call end` as the host gets a silent HTTP 429: the caller's
    // Calls rate limiter (burst 10, 1/sec refill) is drained by WebRTC ICE exchange
    // during call setup, and the EndCallConfirmation modal swallows the rejection.
    // Ending via the plugin's REST endpoint as sysadmin uses a bucket no call traffic
    // has touched, so what is actually covered here is the desktop side: the widget
    // and the channel/sidebar affordances react correctly when a call ends.
    //
    // Slash-command coverage for `/call end` is therefore still missing. Restoring it
    // needs the rate-limit interaction solved first, not another wait.
    test(
        'MM-T5588 host ends the call (via Calls REST API) — desktop tears the call down',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            await startCall(electronApp, serverWin);

            await apiRequest(testServerUrl, adminToken, `/plugins/com.mattermost.calls/calls/${testChannel.id}/end`, {
                method: 'POST',
            });

            await expect.poll(
                () => findCallsWidgetWindow(electronApp),
                {timeout: 30_000, message: 'Calls widget must close after the call is ended'},
            ).toBeNull();

            await expect.poll(
                () => serverWin.isVisible('#calls-channel-toast'),
                {timeout: 15_000, message: '#calls-channel-toast must not be visible after call ends'},
            ).toBe(false);

            await expect.poll(
                () => serverWin.isVisible('[data-testid="calls-sidebar-active-call-icon"]'),
                {timeout: 15_000, message: 'Sidebar active call icon must not be visible after call ends'},
            ).toBe(false);
        },
    );

    test(
        'MM-T5589 /call stats — returns call statistics',
        {tag: ['@P1', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);

            await closeCallsWidget(electronApp, widgetWindow, serverWin);
            await sendSlashCommand(serverWin, '/call stats');

            // /call stats posts an ephemeral response with the stats JSON.
            // CallsClientStats keys: initTime, channelID, tracksInfo, rtcStats.
            // Use :has-text() to find the post by content, independent of class or position.
            // CallsClientStats: initTime is stable. channelID replaced callID in
            // mattermost-plugin-calls#1220 (1.12); 11.7 / 10.11 still post callID.
            await expect.poll(
                async () => serverWin.locator(".post__body:has-text('initTime')").last().textContent(),
                {timeout: 15_000, message: '/call stats must post a response containing call statistics'},
            ).toContain('initTime');

            const statsText = String(await serverWin.locator(".post__body:has-text('initTime')").last().textContent() ?? '');
            const hasCallIdentity = statsText.includes('channelID') || statsText.includes('callID');
            expect(
                hasCallIdentity,
                '/call stats JSON must include channelID (1.12+) or callID (older Calls)',
            ).toBe(true);
        },
    );

    test(
        'MM-T5590 /call logs — returns call log output',
        {tag: ['@P1', '@all']},
        async () => {
            // beforeEach logs out and creates a new user, which wipes in-memory
            // Calls logs. Seed both storages: Calls getPersistentStorage() uses
            // localStorage when window.desktop is set, otherwise sessionStorage.
            await serverWin.runInRenderer<void>(`
                const seed = 'debug [e2e] pre-seeded call log for MM-T5590\\n';
                for (const storage of [localStorage, sessionStorage]) {
                    if (!(storage.getItem('calls_client_logs') || '').trim()) {
                        storage.setItem('calls_client_logs', seed);
                    }
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
