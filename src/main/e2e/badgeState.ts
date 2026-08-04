// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setTestField} from 'common/utils/util';

export type BadgeTestState = {
    sessionExpired: boolean;
    mentionCount: number;
    showUnreadBadge: boolean;
    resolvedType: 'mention' | 'unread' | 'expired' | 'none';
    hasOverlay: boolean;
};

/** Records badge resolution for E2E assertions. No-op outside NODE_ENV=test. */
export function recordBadgeTestState(
    sessionExpired: boolean,
    mentionCount: number,
    showUnreadBadge: boolean,
    showUnreadBadgeSetting: boolean,
): void {
    if (process.env.NODE_ENV !== 'test') {
        return;
    }

    let resolvedType: BadgeTestState['resolvedType'];
    if (process.platform === 'linux') {
        if (mentionCount > 0) {
            resolvedType = 'mention';
        } else if (sessionExpired) {
            resolvedType = 'expired';
        } else {
            resolvedType = 'none';
        }
    } else if (mentionCount > 0) {
        resolvedType = 'mention';
    } else if (showUnreadBadge && showUnreadBadgeSetting) {
        resolvedType = 'unread';
    } else if (sessionExpired) {
        resolvedType = 'expired';
    } else {
        resolvedType = 'none';
    }

    const hasOverlay = process.platform === 'win32' && resolvedType !== 'none';
    setTestField('__testBadgeState', {sessionExpired, mentionCount, showUnreadBadge, resolvedType, hasOverlay});
}
