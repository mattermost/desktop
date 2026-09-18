// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {apiLogin} from '../../helpers/server_api/client';
import {CALLS_PLUGIN_ID, isCallsPluginEnabled} from '../../helpers/server_api/plugin';

// Assertion only. The install/enable/configure work happens once per run in
// global-setup.ts, before any worker starts — see the comment on setUpCallsPlugin
// there for why it must not live in a spec's beforeAll.
test.describe('calls/plugin_setup', () => {
    // No grantMediaPermissions — this spec never opens a call.
    test.use({appConfig: demoMattermostConfig});

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

            expect(
                await isCallsPluginEnabled(serverUrl, token),
                `Calls plugin (${CALLS_PLUGIN_ID}) must be active after global setup`,
            ).toBe(true);
        },
    );
});
