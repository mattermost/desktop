'use strict';

const OriginalNotification = Notification;
const {app, ipcRenderer, remote} = require('electron');
const {throttle} = require('underscore');

const log = require('electron-log');

var format = require('util');

const osVersion = require('../../common/osVersion');
const path = require('path');

const appIconURL = `file:///${remote.app.getAppPath()}/assets/appicon.png`;


const isDev = require('electron-is-dev')

let dingPath;

if (isDev) {
   dingPath = path.join(remote.app.getAppPath(), '../resources/ding.mp3'); // https://github.com/mattermost/platform/blob/v3.7.3/webapp/images/ding.mp3
} else {
   dingPath = path.join(remote.app.getAppPath(), '../ding.mp3'); // https://github.com/mattermost/platform/blob/v3.7.3/webapp/images/ding.mp3
}

console.log(dingPath);

class EnhancedNotification extends OriginalNotification {
  constructor(title, options) {
    if (process.platform === 'win32') {
      // Replace with application icon.
      options.icon = appIconURL;
    } else if (process.platform === 'darwin') {
      // Notification Center shows app's icon, so there were two icons on the notification.
      Reflect.deleteProperty(options, 'icon');
    }

    const sound = dingPath;
    super(title, Object.assign({ sound }, options));

    this.sound = sound;
    options.sound = sound;

    ipcRenderer.send('notified', {
      title,
      options,
      sound
    });
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

module.exports = EnhancedNotification;

new EnhancedNotification('hello', {});
