// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const OriginalNotification = Notification;
import {throttle} from 'underscore';
import {ipcRenderer, remote} from 'electron';

import osVersion from '../../common/osVersion';

import ding from '../../assets/sounds/ding.mp3';
import bing from '../../assets/sounds/bing.mp3';
import crackle from '../../assets/sounds/crackle.mp3';
import down from '../../assets/sounds/down.mp3';
import hello from '../../assets/sounds/hello.mp3';
import ripple from '../../assets/sounds/ripple.mp3';
import upstairs from '../../assets/sounds/upstairs.mp3';

const DEFAULT_WIN7 = 'Ding';
const notificationSounds = new Map([
  [DEFAULT_WIN7, ding],
  ['Bing', bing],
  ['Crackle', crackle],
  ['Down', down],
  ['Hello', hello],
  ['Ripple', ripple],
  ['Upstairs', upstairs],
]);

const appIconURL = `file:///${remote.app.getAppPath()}/assets/appicon_48.png`;

const playSound = throttle((soundName) => {
  const audio = new Audio(notificationSounds.get(soundName));
  audio.play();
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

    const isWin7 = (process.platform === 'win32' && osVersion.isLowerThanOrEqualWindows8_1() && DEFAULT_WIN7);
    const customSound = !options.silent && ((options.data && options.data.soundName && options.data.soundName !== 'None') || isWin7);
    if (customSound) {
      // disable native sound
      options.silent = true;
    }

    super(title, options);

    ipcRenderer.send('notified', {
      title,
      options,
    });

    if (customSound) {
      playSound(customSound);
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
