'use strict';

var ipc = require('ipc');

ipc.on('retrieveUnreadCount', function() {
  var unreadCount = document.getElementsByClassName('unread-title').length;
  ipc.sendToHost('retrieveUnreadCount', unreadCount);
});
