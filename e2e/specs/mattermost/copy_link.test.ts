// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

test.describe('copylink', () => {
    test.use({appConfig: demoMattermostConfig});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');
    test.skip(process.platform === 'linux', 'Not supported on Linux');

    test('MM-T125 Copy Link can be used from channel LHS', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        if (!firstServer) {
            throw new Error('No server view available');
        }

        await loginToMattermost(firstServer);

        // Clear clipboard to prevent pollution from other tests
        await electronApp.evaluate(({clipboard}) => {
            clipboard.writeText('');
        });

        // Right-click the sidebar item to trigger the context menu
        await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
        await firstServer.click('#sidebarItem_town-square', {button: 'right'});

        // Click "Copy Link" from the context menu.
        // Use a longer timeout to accommodate CI latency, and match both "Copy Link"
        // and "Copy link" (capitalization varies by Mattermost version).
        const copyLinkItem = await firstServer.waitForSelector(
            'button:has-text("Copy Link"), button:has-text("Copy link")',
            {timeout: 15_000},
        );
        await copyLinkItem.click();

        const clipboardText = await electronApp.evaluate(({clipboard}) => {
            return clipboard.readText();
        });
        expect(clipboardText).toContain('/channels/town-square');
    });
});
