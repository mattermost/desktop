// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindow} from 'electron';
import {app, nativeImage} from 'electron';

import AppState from 'common/appState';
import {UPDATE_APPSTATE_TOTALS} from 'common/communication';
import {Logger} from 'common/log';
import {localizeMessage} from 'main/i18nManager';

import MainWindow from './windows/mainWindow';

const log = new Logger('Badge');
const MAX_WIN_COUNT = 99;

let showUnreadBadgeSetting: boolean;

/**
     * Badge generation for Windows
     */

function drawBadge(text: string, small: boolean) {
    const scale = 2; // should rely display dpi
    const size = (small ? 20 : 16) * scale;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', `${size}`);
    canvas.setAttribute('height', `${size}`);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        log.error('Could not create canvas context');
        return null;
    }

    // circle
    ctx.fillStyle = '#FF1744'; // Material Red A400
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = (11 * scale) + 'px sans-serif';
    ctx.fillText(text, size / 2, size / 2, size);

    return canvas.toDataURL();
}

function createDataURL(win: BrowserWindow, text: string, small: boolean) {
    // since we don't have a document/canvas object in the main process, we use the webcontents from the window to draw.
    const code = `
    window.drawBadge = ${drawBadge};
    window.drawBadge('${text || ''}', ${small});
  `;
    return win.webContents.executeJavaScript(code);
}

async function setOverlayIcon(badgeText: string | undefined, description: string, small: boolean) {
    let overlay = null;
    const mainWindow = MainWindow.get();
    if (mainWindow) {
        if (badgeText) {
            try {
                const dataUrl = await createDataURL(mainWindow, badgeText, small);
                overlay = nativeImage.createFromDataURL(dataUrl);
            } catch (err) {
                log.error('Could not generate a badge:', err);
            }
        }
        mainWindow.setOverlayIcon(overlay, description);
    }
}

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
        text = '!';
        description = localizeMessage('main.badge.sessionExpired', 'Session Expired: Please sign in to continue receiving notifications.');
    }
    setOverlayIcon(text, description, mentionCount > 99);
}

export function showBadgeOSX(sessionExpired: boolean, mentionCount: number, showUnreadBadge: boolean) {
    let badge = '';
    if (mentionCount > 0) {
        badge = mentionCount.toString();
    } else if (showUnreadBadge && showUnreadBadgeSetting) {
        badge = '•';
    } else if (sessionExpired) {
        badge = '!';
    }
    app.dock?.setBadge(badge);
}

function showBadgeLinux(sessionExpired: boolean, mentionCount: number) {
    if (app.isUnityRunning()) {
        const countExpired = sessionExpired ? 1 : 0;
        app.setBadgeCount(mentionCount + countExpired);
    }
}

function showBadge(sessionExpired: boolean, mentionCount: number, showUnreadBadge: boolean) {
    log.silly('showBadge', {sessionExpired, mentionCount, showUnreadBadge});

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
    AppState.emitStatus();
}

export function setupBadge() {
    AppState.on(UPDATE_APPSTATE_TOTALS, showBadge);
}
