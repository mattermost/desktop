// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';
import {simulateNotificationClick} from '../../helpers/notificationClick';
import {resolveChannelByName} from '../../helpers/server_api/channel';
import {getActiveServerWebContentsId} from '../../helpers/testRefs';
import {hideMainWindow, isMainWindowVisible, showMainWindowIfHidden} from '../../helpers/tray';

test.use({appConfig: demoMattermostConfig});
test.setTimeout(120_000);

test(
    'clicking a notification navigates to the correct channel',
    {tag: ['@P0', '@all']},
    async ({electronApp, serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const releaseLock = await acquireExclusiveLock('notification-state');
        try {
            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            const serverWin = serverEntry?.win;
            expect(serverWin, 'No server view available').toBeTruthy();

            await loginToMattermost(serverWin!);
            await serverWin!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

            const targetChannel = await resolveChannelByName('off-topic');
            const targetPathname = new URL(targetChannel.url).pathname;

            await hideMainWindow(electronApp);

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 5_000, message: 'Main window should be hidden before notification click'},
            ).toBe(false);

            await simulateNotificationClick(electronApp, {
                webContentsId: await getActiveServerWebContentsId(electronApp),
                channelId: targetChannel.id,
                teamId: targetChannel.teamId,
                url: targetChannel.url,
            });

            await expect.poll(
                () => serverWin!.evaluate(() => window.location.pathname),
                {timeout: 10_000, message: 'View should navigate to the clicked channel path'},
            ).toBe(targetPathname);

            await expect.poll(
                () => isMainWindowVisible(electronApp),
                {timeout: 10_000, message: 'Main window should be visible after notification click navigation'},
            ).toBe(true);
        } finally {
            await showMainWindowIfHidden(electronApp);
            await releaseLock();
        }
    },
);
