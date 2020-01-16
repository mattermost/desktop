// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const OriginalNotification = Notification;
import {throttle} from 'underscore';

import {ipcRenderer, remote} from 'electron';

import osVersion from '../../common/osVersion';
import dingDataURL from '../../assets/ding.mp3'; // https://github.com/mattermost/platform/blob/v3.7.3/webapp/images/ding.mp3

const appIconURL = `file:///${remote.app.getAppPath()}/assets/appicon_48.png`;

const playDing = throttle(() => {
  const ding = new Audio(dingDataURL);
  ding.play();
}, 3000, {trailing: false});

export default class EnhancedNotification extends OriginalNotification {
  constructor(title, options) {
    if (process.platform === 'win32') {
      // Replace with application icon.
      options.icon = appIconURL;
    } else if (process.platform === 'darwin') {
      // Notification Center shows app's icon, so there were two icons on the notification.
      Reflect.deleteProperty(options, 'icon');
    }

    super(title, options);

    ipcRenderer.send('notified', {
      title,
      options,
    });

    if (process.platform === 'win32' && osVersion.isLowerThanOrEqualWindows8_1()) {
      if (!options.silent) {
        playDing();
      }
    }
  }

  set onclick(handler) {
    super.onclick = () => {
      const currentWindow = remote.getCurrentWindow();
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
      ipcRenderer.sendToHost('onNotificationClick');
      handler();
    };
  }

  get onclick() {
    return super.onclick;
  }
}
