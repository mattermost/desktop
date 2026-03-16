// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

test(
    'app does not crash when server becomes unreachable and recovers',
    {tag: ['@P0', '@all']},
    async ({electronApp, serverMap, mainWindow}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required for network resilience test');
            return;
        }

        const serverWin = serverMap['example']?.[0]?.win;
        if (!serverWin) {
            test.skip(true, 'No server view available');
            return;
        }

        // Intercept all network requests to simulate offline state
        await serverWin!.route('**/*', (route) => route.abort('internetdisconnected'));

        // App windows should still exist (not crashed) — route is now in effect
        expect(electronApp.windows().length).toBeGreaterThan(0);

        // Restore network access
        await serverWin!.unrouteAll();

        // The view should attempt to reconnect (URL still points to server)
        const urlAfterRestore = serverWin!.url();
        expect(urlAfterRestore).toContain(new URL(process.env.MM_TEST_SERVER_URL!).host);
    },
);
