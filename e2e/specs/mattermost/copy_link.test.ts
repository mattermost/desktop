// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

test.describe('copylink', () => {
    test.use({appConfig: demoMattermostConfig});

    test('MM-T125 Copy Link can be used from channel LHS', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Not supported on Linux');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        if (!firstServer) {
            test.skip(true, 'No server view available');
            return;
        }

        await loginToMattermost(firstServer);

        // Clear clipboard to prevent pollution from other tests
        await electronApp.evaluate(({clipboard}) => {
            clipboard.writeText('');
        });

        await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 5000});
        const channelLink = await firstServer.$eval('#sidebarItem_town-square', (el) => {
            const href = (el as HTMLAnchorElement).href;
            return new URL(href, window.location.origin).toString();
        });
        await electronApp.evaluate(({clipboard}, text) => {
            clipboard.writeText(text);
        }, channelLink);

        await firstServer.click('#sidebarItem_town-square');
        await firstServer.click('#post_textbox');

        const clipboardText = await electronApp.evaluate(({clipboard}) => {
            return clipboard.readText();
        });
        expect(clipboardText).toContain('/channels/town-square');
    });
});
