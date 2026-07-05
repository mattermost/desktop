// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {getBadgeState, setUnreadBadgeSetting, triggerBadge, waitForBadgeHooks} from '../../helpers/badgeTrigger';

test.describe('server_management/unread_badge', () => {
    test.beforeEach(async ({electronApp}) => {
        if (process.platform === 'linux') {
            return;
        }
        await waitForBadgeHooks(electronApp);
        await setUnreadBadgeSetting(electronApp, false);
    });

    test.afterEach(async ({electronApp}) => {
        if (process.platform === 'linux') {
            return;
        }
        await setUnreadBadgeSetting(electronApp, false);
    });

    test(
        'MM-T1291 Show red badge on taskbar for unread messages',
        {tag: ['@P2', '@darwin', '@win32']},
        async ({electronApp}) => {
            test.skip(process.platform === 'linux', 'Unread dot badge is not supported on Linux Unity path');

            await setUnreadBadgeSetting(electronApp, true);
            await triggerBadge(electronApp, false, 0, true);
            expect((await getBadgeState(electronApp))?.resolvedType).toBe('unread');

            await triggerBadge(electronApp, false, 3, false);
            const state = await getBadgeState(electronApp);
            expect(state?.resolvedType).toBe('mention');
            expect(state?.mentionCount).toBe(3);
        },
    );

    test(
        'MM-T1292 Do not show red badge when setting disabled except mentions',
        {tag: ['@P2', '@darwin', '@win32']},
        async ({electronApp}) => {
            test.skip(process.platform === 'linux', 'Unread dot badge is not supported on Linux Unity path');

            await setUnreadBadgeSetting(electronApp, false);
            await triggerBadge(electronApp, false, 0, true);
            expect((await getBadgeState(electronApp))?.resolvedType).toBe('none');

            await triggerBadge(electronApp, false, 2, false);
            const state = await getBadgeState(electronApp);
            expect(state?.resolvedType).toBe('mention');
            expect(state?.mentionCount).toBe(2);
        },
    );
});
