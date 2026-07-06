// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {
    clearAllBadgesViaAppState,
    readOsBadge,
    setServerExpiredViaAppState,
    setUnreadBadgeSetting,
    updateServerBadgeViaAppState,
    waitForBadgeInfrastructure,
} from '../../helpers/badge';
import {demoConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';

const FIRST_SERVER = demoConfig.servers[0].name;

test.describe('notification_trigger/notification_badge', () => {
    test.use({appConfig: demoConfig});
    test.setTimeout(120_000);

    test.beforeEach(async ({electronApp}) => {
        await waitForAppReady(electronApp);
        await waitForBadgeInfrastructure(electronApp);
    });

    // These three run unconditionally rather than skipping without a running Unity
    // desktop (true on every headless CI runner): app.getBadgeCount()/setBadgeCount()
    // are Unity-only no-ops there, so readOsBadge() falls back to re-deriving the
    // count from __testBadgeState using the same arithmetic showBadgeLinux() uses.
    // That keeps these tests exercising the real AppState -> showBadge() dispatch
    // on every run, with a real OS read only when a Unity session happens to exist.

    test('MM-T_BADGE_LNX mention count via AppState',
        {tag: ['@P2', '@linux']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 5, false);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Linux badge count must reflect AppState mention total'},
                ).toMatchObject({count: 5, symbol: 'mention'});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_LNX session expired via AppState',
        {tag: ['@P2', '@linux']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await setServerExpiredViaAppState(electronApp, FIRST_SERVER, true);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Linux badge must show session expired'},
                ).toMatchObject({count: 1, symbol: 'expired'});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_LNX mentions beat session expired',
        {tag: ['@P2', '@linux']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await setServerExpiredViaAppState(electronApp, FIRST_SERVER, true);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 3, false);

                // showBadgeLinux() adds 1 for the still-expired session on top of the
                // mention count (it doesn't clear `expired` when mentions arrive), so
                // the real badge total is 3 + 1 = 4. The symbol still resolves to
                // 'mention' since resolvedType only tracks priority, not the sum.
                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Mention count must win priority over session expired on Linux'},
                ).toMatchObject({count: 4, symbol: 'mention'});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_OSX dock badge via AppState',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 7, false);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'macOS dock badge must reflect AppState mention total'},
                ).toMatchObject({count: 7, symbol: 'mention'});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_OSX unread dot via AppState',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await setUnreadBadgeSetting(electronApp, true);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 0, true);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'macOS dock must show unread dot when setting enabled'},
                ).toMatchObject({symbol: 'unread'});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_OSX clear badge via AppState',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 4, false);
                await clearAllBadgesViaAppState(electronApp);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'macOS dock badge must clear when AppState totals reset'},
                ).toMatchObject({count: 0, symbol: 'none'});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_WIN overlay via AppState',
        {tag: ['@P2', '@win32']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 5, false);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Windows taskbar overlay must appear for mentions'},
                ).toMatchObject({hasOverlay: true, symbol: 'mention', count: 5});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_WIN unread overlay via AppState',
        {tag: ['@P2', '@win32']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await clearAllBadgesViaAppState(electronApp);
                await setUnreadBadgeSetting(electronApp, true);
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 0, true);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Windows taskbar overlay must appear for unreads when enabled'},
                ).toMatchObject({hasOverlay: true, symbol: 'unread'});
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T_BADGE_WIN clear overlay via AppState',
        {tag: ['@P2', '@win32']},
        async ({electronApp}) => {
            const releaseLock = await acquireExclusiveLock('notification-badge-state');
            try {
                await updateServerBadgeViaAppState(electronApp, FIRST_SERVER, 2, false);
                await clearAllBadgesViaAppState(electronApp);

                await expect.poll(
                    () => readOsBadge(electronApp),
                    {timeout: 10_000, message: 'Windows taskbar overlay must clear when AppState totals reset'},
                ).toMatchObject({hasOverlay: false, symbol: 'none', count: 0});
            } finally {
                await releaseLock();
            }
        },
    );
});
