// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import {UPDATE_BADGE} from 'common/communication';

import * as WindowManager from './windows/windowManager';
import * as AppState from './appState';

const MAX_WIN_COUNT = 99;

function createDataURL(text, small) {
  const scale = 2; // should rely display dpi
  const size = (small ? 20 : 16) * scale;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('width', size);
  canvas.setAttribute('height', size);
  const ctx = canvas.getContext('2d');

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

function showBadgeWindows(sessionExpired, showUnreadBadge, mentionCount) {
  let description = 'You have no unread messages';
  let text;
  if (sessionExpired) {
    text = '•';
    description = 'Session Expired: Please sign in to continue receiving notifications.';
  } else if (mentionCount > 0) {
    text = (mentionCount > MAX_WIN_COUNT) ? `${MAX_WIN_COUNT}+` : mentionCount.toString();
    description = `You have unread mentions (${mentionCount})`;
  } else if (showUnreadBadge) {
    text = '•';
    description = 'You have unread channels';
  }
  WindowManager.setOverlayIcon(text, description);
}

function showBadgeOSX(sessionExpired, showUnreadBadge, mentionCount) {
  let badge = '';
  if (sessionExpired) {
    badge = '•';
  } else if (mentionCount > 0) {
    badge = mentionCount.toString();
  } else if (showUnreadBadge) {
    badge = '•';
  }
  app.dock.setBadge(badge);
}

function showBadgeLinux(sessionExpired, showUnreadBadge, mentionCount) {
  if (app.isUnityRunning()) {
    const countExpired = sessionExpired ? 1 : 0;
    app.setBadgeCount(mentionCount + countExpired);
  }
}

function showBadge(sessionExpired, mentionCount, showUnreadBadge) {
  switch (process.platform) {
  case 'win32':
    showBadgeWindows(sessionExpired, showUnreadBadge, mentionCount);
    break;
  case 'darwin':
    showBadgeOSX(sessionExpired, showUnreadBadge, mentionCount);
    break;
  case 'linux':
    showBadgeLinux(sessionExpired, showUnreadBadge, mentionCount);
    break;
  }
}

export function setupBadge() {
  AppState.on(UPDATE_BADGE, showBadge);
}
