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

    // Suite-level, so the electronApp fixture is never built on an unconfigured run.
    test.skip(
        !process.env.MM_TEST_SERVER_URL || !process.env.MM_TEST_USER_NAME || !process.env.MM_TEST_PASSWORD,
        'MM_TEST_SERVER_URL, MM_TEST_USER_NAME and MM_TEST_PASSWORD required',
    );

    test('Calls plugin is installed and enabled on the test server',
        {tag: ['@P1', '@all']},
        async () => {
            // Non-null: guaranteed by the suite-level skip above.
            const serverUrl = process.env.MM_TEST_SERVER_URL!;
            const token = await apiLogin(
                serverUrl,
                process.env.MM_TEST_USER_NAME!,
                process.env.MM_TEST_PASSWORD!,
            );

            expect(
                await isCallsPluginEnabled(serverUrl, token),
                `Calls plugin (${CALLS_PLUGIN_ID}) must be active after global setup`,
            ).toBe(true);
        },
    );
});
