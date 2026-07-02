// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';
import {resolveChannelByName} from '../../helpers/server_api/channel';
import {hideMainWindow, isMainWindowVisible} from '../../helpers/tray';

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

            await electronApp.evaluate((payload) => {
                const displayAndClick = (global as any).__e2eDisplayAndClickMention as
                    | ((value: typeof payload) => Promise<void>)
                    | undefined;
                if (!displayAndClick) {
                    throw new Error('__e2eDisplayAndClickMention not exposed (NODE_ENV must be test)');
                }
                return displayAndClick({
                    webContentsId: payload.webContentsId,
                    title: 'E2E mention',
                    body: 'Notification click test',
                    channelId: payload.channelId,
                    teamId: payload.teamId,
                    url: payload.url,
                });
            }, {
                webContentsId: serverEntry!.webContentsId,
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
            await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const mainWindow = refs?.MainWindow?.get?.();
                if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
                    refs?.MainWindow?.show?.();
                }
            }).catch(() => {});
            await releaseLock();
        }
    },
);
