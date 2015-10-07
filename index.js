'use strict';

var ipc = require('ipc');

var webView = document.getElementById('mainWebview');

// Open in default browser.
webView.addEventListener('new-window', function(e) {
  require('shell').openExternal(e.url);
});

// Count unread channels.
var timer = setInterval(function() {
  webView.send('retrieveUnreadCount');
}, 1000);

webView.addEventListener('ipc-message', function(event){
  switch (event.channel) {
    case 'retrieveUnreadCount':
      var unreadCount = event.args[0];
      ipc.send('retrieveUnreadCount', unreadCount);
      break;
  }
});
