// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {loginToMattermost} from '../../helpers/login';

test(
    'clicking a notification navigates to the correct channel',
    {tag: ['@P0', '@all']},
    async ({electronApp, serverMap, mainWindow}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverWin = serverMap['example']?.[0]?.win;
        if (!serverWin) {
            test.skip(true, 'No server view available');
            return;
        }

        // Log in
        await loginToMattermost(serverWin!);
        await serverWin!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

        // Simulate a notification click for a specific channel via IPC
        // This bypasses the OS notification layer and tests the desktop's click handler
        const channelId = await serverWin!.evaluate(() => {
            // Get the town-square channel ID from the webapp store
            const store = (window as any).store;
            return store?.getState?.()?.entities?.channels?.myMembers &&
                Object.keys(store.getState().entities.channels.myMembers)[0];
        });

        if (!channelId) {
            test.skip(true, 'Could not get channel ID from webapp store');
            return;
        }

        // Emit notification click via Electron IPC
        // Channel name from src/common/communication.ts: NOTIFICATION_CLICKED = 'notification-clicked'
        await electronApp.evaluate(({ipcMain}, id) => {
            ipcMain.emit('notification-clicked', {}, {channelId: id, teamId: ''});
        }, channelId);

        // The active view should navigate to the channel
        await expect.poll(
            () => serverWin!.url(),
            {timeout: 10_000, message: 'View should navigate to clicked channel'},
        ).toContain(channelId as string);
    },
);
