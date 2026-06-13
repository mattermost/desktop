// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {COPY_LINK_SELECTORS, openSidebarChannelMenu} from '../../helpers/channelMenu';
import {loginToMattermost} from '../../helpers/login';

test.describe('copylink', () => {
    test.use({appConfig: demoMattermostConfig});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test('MM-T125 Copy Link can be used from channel LHS', {tag: ['@P2', '@darwin', '@win32']}, async ({electronApp, serverMap}) => {
        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        if (!firstServer) {
            throw new Error('No server view available');
        }

        await loginToMattermost(firstServer);

        await electronApp.evaluate(({clipboard}) => {
            clipboard.writeText('');
        });

        await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
        await openSidebarChannelMenu(firstServer, '#sidebarItem_town-square');

        let copyLinkClicked = false;
        const copyLinkDeadline = Date.now() + 15_000;
        while (!copyLinkClicked && Date.now() < copyLinkDeadline) {
            for (const selector of COPY_LINK_SELECTORS) {
                const candidate = await firstServer.$(selector);
                if (candidate) {
                    await firstServer.click(selector);
                    copyLinkClicked = true;
                    break;
                }
            }
            if (!copyLinkClicked) {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        expect(copyLinkClicked, '"Copy Link" must be clicked in the channel menu').toBe(true);

        await expect.poll(
            async () => electronApp.evaluate(({clipboard}) => clipboard.readText()),
            {timeout: 10_000, message: 'Clipboard must contain the town-square channel link'},
        ).toContain('/channels/town-square');
    });
});
