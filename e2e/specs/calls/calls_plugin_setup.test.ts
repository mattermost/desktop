// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {apiLogin, apiRequest} from '../../helpers/server_api/client';
import {CALLS_PLUGIN_ID, ensureCallsPlugin, isCallsPluginEnabled} from '../../helpers/server_api/plugin';

test.describe('calls/plugin_setup', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('Calls plugin is installed and enabled on the test server',
        {tag: ['@P1', '@all']},
        async () => {
            const serverUrl = process.env.MM_TEST_SERVER_URL;
            const username = process.env.MM_TEST_USER_NAME;
            const password = process.env.MM_TEST_PASSWORD;

            if (!serverUrl || !username || !password) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const token = await apiLogin(serverUrl, username, password);
            await ensureCallsPlugin(serverUrl, token);

            // SiteURL is required by the Calls plugin /logs/upload endpoint to construct
            // DM links in ephemeral posts. Set it here (before slash_commands tests run)
            // so the config_changed WebSocket event and any resulting webapp reload
            // complete well before T5588 executes.
            await apiRequest(serverUrl, token, '/api/v4/config/patch', {
                method: 'PUT',
                body: JSON.stringify({ServiceSettings: {SiteURL: serverUrl}}),
            });

            await expect.poll(
                () => isCallsPluginEnabled(serverUrl, token),
                {timeout: 60_000, message: `Calls plugin (${CALLS_PLUGIN_ID}) must be active after setup`},
            ).toBe(true);
        },
    );
});
