'use strict';

var ipc = require('ipcRenderer');

ipc.on('retrieveUnreadCount', function() {
  var unreadCount = document.getElementsByClassName('unread-title').length;
  ipc.sendToHost('retrieveUnreadCount', unreadCount);
});

// Show balloon when notified.
if (process.platform === 'win32') {
  Notification = function(title, options) {
    ipc.send('notified', {
      title: title,
      options: options
    });
  };
  Notification.requestPermission = function(callback) {
    callback('granted');
  };
  Notification.prototype.close = function() {};
}

// Show window even if it is hidden when notification is clicked.
var NativeNotification = null;
if (process.platform === 'darwin') {
  NativeNotification = Notification;
  Notification = function(title, options) {
    this.notification = new NativeNotification(title, options);
  };
  Notification.requestPermission = function(callback) {
    callback('granted');
  };
  Notification.prototype.close = function() {
    this.notification.close();
  };
  Notification.prototype.__defineSetter__('onclick', function(callback) {
    this.notification.onclick = function() {
      require('remote').getCurrentWindow().show();
      callback();
    };
  });
}
