// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';
import log from 'electron-log';

import {UPDATE_BADGE} from 'common/communication';

import {localizeMessage} from 'main/i18nManager';

import WindowManager from './windows/windowManager';
import * as AppState from './appState';

const MAX_WIN_COUNT = 99;

let showUnreadBadgeSetting: boolean;

export function showBadgeWindows(sessionExpired: boolean, mentionCount: number, showUnreadBadge: boolean) {
    let description = localizeMessage('main.badge.noUnreads', 'You have no unread messages');
    let text;
    if (mentionCount > 0) {
        text = (mentionCount > MAX_WIN_COUNT) ? `${MAX_WIN_COUNT}+` : mentionCount.toString();
        description = localizeMessage('main.badge.unreadMentions', 'You have unread mentions ({mentionCount})', {mentionCount});
    } else if (showUnreadBadge && showUnreadBadgeSetting) {
        text = '•';
        description = localizeMessage('main.badge.unreadChannels', 'You have unread channels');
    } else if (sessionExpired) {
        text = '•';
        description = localizeMessage('main.badge.sessionExpired', 'Session Expired: Please sign in to continue receiving notifications.');
    }
    WindowManager.setOverlayIcon(text, description, mentionCount > 99);
}

export function showBadgeOSX(sessionExpired: boolean, mentionCount: number, showUnreadBadge: boolean) {
    let badge = '';
    if (mentionCount > 0) {
        badge = mentionCount.toString();
    } else if (showUnreadBadge && showUnreadBadgeSetting) {
        badge = '•';
    } else if (sessionExpired) {
        badge = '•';
    }
    app.dock.setBadge(badge);
}

function showBadgeLinux(sessionExpired: boolean, mentionCount: number) {
    if (app.isUnityRunning()) {
        const countExpired = sessionExpired ? 1 : 0;
        app.setBadgeCount(mentionCount + countExpired);
    }
}

function showBadge(sessionExpired: boolean, mentionCount: number, showUnreadBadge: boolean) {
    log.silly('Badge.showBadge', {sessionExpired, mentionCount, showUnreadBadge});

    switch (process.platform) {
    case 'win32':
        showBadgeWindows(sessionExpired, mentionCount, showUnreadBadge);
        break;
    case 'darwin':
        showBadgeOSX(sessionExpired, mentionCount, showUnreadBadge);
        break;
    case 'linux':
        showBadgeLinux(sessionExpired, mentionCount);
        break;
    }
}

export function setUnreadBadgeSetting(showUnreadBadge: boolean) {
    showUnreadBadgeSetting = showUnreadBadge;
    AppState.updateBadge();
}

export function setupBadge() {
    AppState.on(UPDATE_BADGE, showBadge);
}
