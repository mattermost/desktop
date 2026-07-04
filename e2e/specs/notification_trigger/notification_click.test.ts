// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';
import {resolveChannelByName} from '../../helpers/server_api/channel';
import {NOTIFICATION_CLICKED} from '../../../src/common/communication';

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

            await electronApp.evaluate(({webContents}, payload) => {
                const wc = webContents.fromId(payload.webContentsId);
                if (!wc || wc.isDestroyed()) {
                    throw new Error(`webContents ${payload.webContentsId} is not available`);
                }

                wc.send(payload.channel, payload.channelId, payload.teamId, payload.url);
            }, {
                webContentsId: serverEntry!.webContentsId,
                channel: NOTIFICATION_CLICKED,
                channelId: targetChannel.id,
                teamId: targetChannel.teamId,
                url: targetChannel.url,
            });

            await expect.poll(
                () => serverWin!.evaluate(() => window.location.pathname),
                {timeout: 10_000, message: 'View should navigate to the clicked channel path'},
            ).toBe(targetPathname);
        } finally {
            await releaseLock();
        }
    },
);
