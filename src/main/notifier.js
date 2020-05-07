// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Notification, app, BrowserWindow} from 'electron';

const icon = `file:///${app.getAppPath()}/assets/appicon_48.png`;

const NOTIFICATION_TIMEOUT = 10000; // todo: figure out the right amount of time

/**
 * using notifications:
 * - main process notifications should call dispatchNotifications directly and deal with the notification object.
 * - renderer process should do an `ipcRenderer.invoke('dispatch-notification', ...)`
 *
 * responseData object that will contain any info needed to handle the notification back on the renderer
 * it will add a notificationResult key to it, which will take one of three values:
 * - failed, something went wrong
 * - ignored, when the notification showed but user never took action
 * - closed, when the user manually closed it
 * - clicked, when the user clicked on the notification
 **/

export const handleDispatchNotification = (event, title, body, tag, responseData) => {
  console.log(`got notification for ${tag}`);
  const result = new Promise((resolve) => {
    const desktopNotification = dispatchNotification(title, body, tag);
    if (desktopNotification === null) {
      resolve({notificationResult: 'failed', ...responseData});
    } else {
      const timer = setTimeout(() => resolve({notificationResult: 'ignored', ...responseData}), NOTIFICATION_TIMEOUT);

      desktopNotification.on('click', () => {
        clearTimeout(timer);

        // raise window
        const win = BrowserWindow.fromWebContents(event.sender);
        showWindow(win);

        // send message to renderer so it performs any expected action.
        resolve({
          notificationResult: 'clicked',
          ...responseData,
        });
      });
      desktopNotification.on('close', () => {
        clearTimeout(timer);

        // send message to renderer so it performs any expected action.
        resolve({
          notificationResult: 'closed',
          ...responseData,
        });
      });
    }
  });
  return result;
};

function dispatchNotification(title, body, tag) {
  if (Notification.isSupported()) {
    const n = new Notification({
      title,
      body,
      icon,
      tag,
    });

    n.show();
    return n;
  }
  return null;
}

function showWindow(currentWindow) {
  if (process.platform === 'win32') {
    // show() breaks Aero Snap state.
    if (currentWindow.isVisible()) {
      currentWindow.focus();
    } else if (currentWindow.isMinimized()) {
      currentWindow.restore();
    } else {
      currentWindow.show();
    }
  } else if (currentWindow.isMinimized()) {
    currentWindow.restore();
  } else {
    currentWindow.show();
  }
}