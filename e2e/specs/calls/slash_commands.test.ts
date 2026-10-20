// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {TestInfo} from '@playwright/test';

import {test, expect} from '../../fixtures/index';
import {assertCallsSpecsOnShard1} from '../../helpers/assertCallsShard';
import {CALLS_LOG_SEED_MARKER, CALLS_LOG_UPLOAD_MARKER, callsLogsBranch} from '../../helpers/callsLogs';
import {closeCallsWidget, enterCallsTestChannel, findCallsWidgetWindow, leaveCallIfActive, startCall} from '../../helpers/callsWidget';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost, logoutFromMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {apiLogin, apiRequest} from '../../helpers/server_api/client';
import {resolveCallsPluginVersion} from '../../helpers/server_api/plugin';
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
            // Calls 1.12+ posts channelID; older versions post callID.
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
            // Append when a previous test in this serial file already persisted logs,
            // so the seed is still present for Calls < 1.12.0, which echoes storage.
            await serverWin.runInRenderer<void>(`
                const marker = ${JSON.stringify(CALLS_LOG_SEED_MARKER)};
                const seed = 'debug [e2e] ' + marker + '\\n';
                for (const storage of [localStorage, sessionStorage]) {
                    const current = storage.getItem('calls_client_logs') || '';
                    if (!current.includes(marker)) {
                        storage.setItem('calls_client_logs', current + seed);
                    }
                }
            `);

            const callsVersion = await resolveCallsPluginVersion();
            const branch = callsLogsBranch(callsVersion);
            test.info().annotations.push({
                type: 'calls-version',
                description: callsVersion ?? 'unresolved',
            });

            await sendSlashCommand(serverWin, '/call logs');

            let matched = 'none';
            const postText = async (marker: string): Promise<string> => {
                const text = await serverWin.locator(`.post__body:has-text('${marker}')`).last().textContent();
                return typeof text === 'string' ? text : '';
            };
            try {
                switch (branch) {
                case 'modern':
                    await expect.poll(
                        async () => postText(CALLS_LOG_UPLOAD_MARKER),
                        {timeout: 15_000, message: '/call logs must post a response confirming log upload'},
                    ).toContain(CALLS_LOG_UPLOAD_MARKER);
                    matched = CALLS_LOG_UPLOAD_MARKER;
                    break;
                case 'legacy':
                    await expect.poll(
                        async () => postText(CALLS_LOG_SEED_MARKER),
                        {timeout: 15_000, message: '/call logs must echo the seeded client log'},
                    ).toContain(CALLS_LOG_SEED_MARKER);
                    matched = CALLS_LOG_SEED_MARKER;
                    break;
                case 'unresolved': {
                    let found = '';
                    await expect.poll(
                        async () => {
                            const uploaded = await postText(CALLS_LOG_UPLOAD_MARKER);
                            if (uploaded.includes(CALLS_LOG_UPLOAD_MARKER)) {
                                found = CALLS_LOG_UPLOAD_MARKER;
                                return uploaded;
                            }
                            const seeded = await postText(CALLS_LOG_SEED_MARKER);
                            if (seeded.includes(CALLS_LOG_SEED_MARKER)) {
                                found = CALLS_LOG_SEED_MARKER;
                                return seeded;
                            }
                            return '';
                        },
                        {timeout: 15_000, message: '/call logs must post an upload confirmation or the seeded client log'},
                    ).toMatch(/Call logs uploaded|pre-seeded call log for MM-T5590/);
                    matched = found;
                    break;
                }
                default: {
                    const unexpected: never = branch;
                    throw new Error(`Unexpected /call logs branch: ${unexpected}`);
                }
                }
            } finally {
                test.info().annotations.push({
                    type: 'calls-logs-branch',
                    description: `${branch}:${matched}`,
                });
                // eslint-disable-next-line no-console
                console.log(`[MM-T5590] calls=${callsVersion ?? 'unresolved'} branch=${branch}:${matched}`);
            }
        },
    );
});
