// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {
    clearAllBadgesViaAppState,
    readOsBadge,
    setUnreadBadgeSetting,
    updateServerBadgeViaAppState,
    waitForBadgeInfrastructure,
} from '../../helpers/badge';
import {demoConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';

const FIRST_SERVER = demoConfig.servers[0].name;

test.describe('server_management/unread_badge', () => {
    test.beforeEach(async ({electronApp}) => {
        if (process.platform === 'linux') {
            return;
        }
        await waitForBadgeInfrastructure(electronApp);
    });

    test.afterEach(async ({electronApp}) => {
        if (process.platform === 'linux') {
            return;
        }
        await clearAllBadgesViaAppState(electronApp);
    });

    test(
        'MM-T1291 Show red badge on taskbar for unread messages',
        {tag: ['@P2', '@darwin', '@win32']},
        async ({electronApp}) => {
            test.skip(process.platform === 'linux', 'Unread dot badge is not supported on Linux Unity path');

            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await setUnreadBadgeSetting(electronApp, true);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 0, true);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Badge must show unread state when setting enabled'},
                ).toMatchObject({symbol: 'unread'});

                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 3, false);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Badge must show mention count'},
                ).toMatchObject({symbol: 'mention', count: 3});
            } finally {
                await releaseLock();
            }
        },
    );

    test(
        'MM-T1292 Do not show red badge when setting disabled except mentions',
        {tag: ['@P2', '@darwin', '@win32']},
        async ({electronApp}) => {
            test.skip(process.platform === 'linux', 'Unread dot badge is not supported on Linux Unity path');

            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await setUnreadBadgeSetting(electronApp, false);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 0, true);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Unread badge must stay hidden when setting disabled'},
                ).toMatchObject({symbol: 'none'});

                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 2, false);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Mention badge must still appear when setting disabled'},
                ).toMatchObject({symbol: 'mention', count: 2});
            } finally {
                await releaseLock();
            }
        },
    );
});
