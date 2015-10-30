'use strict';

var ipc = require('ipc');

ipc.on('retrieveUnreadCount', function() {
  var unreadCount = document.getElementsByClassName('unread-title').length;
  ipc.sendToHost('retrieveUnreadCount', unreadCount);
});

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
