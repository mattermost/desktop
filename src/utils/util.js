// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import electron, {remote} from 'electron';
import log from 'electron-log';

function getDisplayBoundaries() {
  const {screen} = electron;

  const displays = screen.getAllDisplays();

  return displays.map((display) => {
    return {
      maxX: display.workArea.x + display.workArea.width,
      maxY: display.workArea.y + display.workArea.height,
      minX: display.workArea.x,
      minY: display.workArea.y,
      maxWidth: display.workArea.width,
      maxHeight: display.workArea.height,
    };
  });
}

const dispatchNotification = async (title, body, silent, data, handleClick) => {
  let permission;
  const appIconURL = `file:///${remote.app.getAppPath()}/assets/appicon_48.png`;
  if (Notification.permission === 'default') {
    permission = await Notification.requestPermission();
  } else {
    permission = Notification.permission;
  }

  if (permission !== 'granted') {
    log.error('Notifications not granted');
    return null;
  }

  const notification = new Notification(title, {
    body,
    tag: body,
    icon: appIconURL,
    requireInteraction: false,
    silent,
    data,
  });

  notification.onclick = handleClick;

  notification.onerror = () => {
    log.error('Notification failed to show');
  };

  return notification;
};

export default {
  getDisplayBoundaries,
  dispatchNotification,
};
