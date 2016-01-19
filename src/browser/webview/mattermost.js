'use strict';

const electron = require('electron');
const ipc = electron.ipcRenderer;
const NativeNotification = Notification;

var unreadCountTimer = setInterval(function() {
  if (!this.count) {
    this.count = 0;
  }

  // count in sidebar
  // Note: the active channel doesn't have '.unread-title'.
  var unreadCount = document.getElementsByClassName('unread-title').length;
  if (this.count != unreadCount) {
    ipc.sendToHost('onUnreadCountChange', unreadCount);
  }
  this.count = unreadCount;
}, 1000);

// On Windows 8.1 and Windows 8, a shortcut with a Application User Model ID must be installed to the Start screen.
// In current version, use tray balloon for notification
function isLowerThanOrEqualWindows8_1() {
  if (process.platform != 'win32') {
    return false;
  }
  var osVersion = require('../../common/osVersion');
  return (osVersion.major <= 6 && osVersion.minor <= 3);
};

// Show balloon when notified.
function overrideNotificationWithBalloon() {
  Notification = function(title, options) {
    ipc.send('notified', {
      title: title,
      options: options
    });

    // Send notification event at active channel.
    var activeChannel = document.querySelector('.active .sidebar-channel').text;
    if (activeChannel === title) {
      ipc.sendToHost('onActiveChannelNotify');
    }
  };
  Notification.requestPermission = function(callback) {
    callback('granted');
  };
  Notification.prototype.close = function() {};
};

// Show window even if it is hidden/minimized when notification is clicked.
function overrideNotification() {
  Notification = function(title, options) {
    this.notification = new NativeNotification(title, options);

    // Send notification event at active channel.
    var activeChannel = document.querySelector('.active .sidebar-channel').text;
    if (activeChannel === title) {
      ipc.sendToHost('onActiveChannelNotify');
    }
  };
  Notification.requestPermission = function(callback) {
    callback('granted');
  };
  Notification.prototype.close = function() {
    this.notification.close();
  };
  Notification.prototype.__defineSetter__('onclick', function(callback) {
    this.notification.onclick = function() {
      if (process.platform === 'win32') {
        // show() breaks Aero Snap state.
        electron.remote.getCurrentWindow().focus();
      }
      else {
        electron.remote.getCurrentWindow().show();
      }
      ipc.sendToHost('onNotificationClick');
      callback();
    };
  });
}

if (process.platform === 'win32' && isLowerThanOrEqualWindows8_1()) {
  overrideNotificationWithBalloon();
}
else {
  overrideNotification();
}
