// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {TestInfo} from '@playwright/test';

import {test, expect} from '../../fixtures/index';
import {assertCallsSpecsOnShard1} from '../../helpers/assertCallsShard';
import {
    callsMuteStateKey,
    closeCallsWidget,
    enterCallsTestChannel,
    getCallsMuteState,
    leaveCallIfActive,
    startCall,
    toggleMuteViaShortcut,
    waitForCallsClientReady,
    waitForCallsWidgetWindow,
} from '../../helpers/callsWidget';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost, logoutFromMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {apiLogin} from '../../helpers/server_api/client';
import {
    apiGetAdminTeamId,
    archiveCallsTestChannels,
    createCallsTestChannel,
    createCallsTestUser,
    deactivateCallsTestUsers,
    type TestUser,
} from '../../helpers/server_api/user';
import type {ServerView} from '../../helpers/serverView';

test.describe('calls/calls_functionality', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig, grantMediaPermissions: true});
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
        // while another worker may be mid-call.
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
        const testChannel = await createCallsTestChannel(testServerUrl, teamId, testUser);
        await loginToMattermost(serverWin, testUser);
        await enterCallsTestChannel(serverWin, testChannel.name);
        await leaveCallIfActive(electronApp, serverWin);
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
                throw new Error('Calls widget did not open — is the Calls plugin enabled and media available?');
            }

            expect(widgetWindow.url(), 'Widget URL must point to Calls plugin').toContain(
                '/plugins/com.mattermost.calls/standalone/widget.html',
            );

            const muteButton = await waitForCallsClientReady(widgetWindow);

            // 1.12+ toggles aria-label ("Mute" / "Unmute"); older widgets use aria-pressed.
            const initialMute = callsMuteStateKey(await getCallsMuteState(widgetWindow));

            await muteButton.click();

            await expect.poll(
                async () => callsMuteStateKey(await getCallsMuteState(widgetWindow)),
                {timeout: 5_000, message: 'Mute button must toggle after click'},
            ).not.toBe(initialMute);

            await closeCallsWidget(electronApp, widgetWindow, serverWin);
        },
    );

    test('MM-T5587 Calls - Slash Commands',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            const widgetWindow = await startCall(electronApp, serverWin);

            expect(widgetWindow.url(), '/call start must open Calls widget').toContain(
                '/plugins/com.mattermost.calls/standalone/widget.html',
            );

            await closeCallsWidget(electronApp, widgetWindow, serverWin);
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
                throw new Error('Calls widget did not open — is the Calls plugin enabled and media available?');
            }

            await waitForCallsClientReady(widgetWindow);
            await widgetWindow.bringToFront();
            await toggleMuteViaShortcut(electronApp, widgetWindow);
            await closeCallsWidget(electronApp, widgetWindow, serverWin);
        },
    );
});

