// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {clickCopyLinkInMenu, openSidebarChannelMenu} from '../../helpers/channelMenu';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';

test.describe('copylink', () => {
    test.use({appConfig: demoMattermostConfig});
    test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

    test('MM-T125 Copy Link can be used from channel LHS', {tag: ['@P2', '@darwin', '@win32']}, async ({electronApp, serverMap}) => {
        const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        if (!serverEntry?.win) {
            throw new Error('No server view available');
        }
        const firstServer = serverEntry.win;

        await prepareMattermostServerView(electronApp, serverEntry.webContentsId);
        await loginToMattermost(firstServer);
        await prepareMattermostServerView(electronApp, firstServer.webContentsId);

        await electronApp.evaluate(({clipboard}) => {
            clipboard.writeText('');
        });

        await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
        await prepareMattermostServerView(electronApp, serverEntry.webContentsId);
        await openSidebarChannelMenu(firstServer, '#sidebarItem_town-square');
        await clickCopyLinkInMenu(firstServer);

        await expect.poll(
            async () => electronApp.evaluate(({clipboard}) => clipboard.readText()),
            {timeout: 10_000, message: 'Clipboard must contain the town-square channel link'},
        ).toContain('/channels/town-square');
    });
});
