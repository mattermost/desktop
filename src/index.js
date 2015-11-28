'use strict';

const electron = require('electron');
const remote = electron.remote;
var url = require('url');

var contextMenu = require('./menus/context');

var webView = document.getElementById('mainWebview');

try {
  var configFile = electron.remote.app.getPath('userData') + '/config.json';
  var config = require(configFile);
  if (config.url) {
    webView.setAttribute('src', config.url);
  }
  else {
    throw 'URL is not configured';
  }
}
catch (e) {
  window.location.href = './settings.html';
}

var menu = contextMenu.createDefault();
window.addEventListener('contextmenu', function(e) {
  menu.popup(remote.getCurrentWindow());
}, false);

webView.addEventListener('page-title-set', function(e) {
  document.title = e.title;
});

// Open external link in default browser.
webView.addEventListener('new-window', function(e) {
  var currentURL = url.parse(webView.getURL());
  var destURL = url.parse(e.url);
  // Open in browserWindow. for exmaple, attached files.
  if (currentURL.host === destURL.host) {
    window.open(e.url, 'Mattermost');
  }
  else {
    require('shell').openExternal(e.url);
  }
});

// Count unread channels.
var timer = setInterval(function() {
  webView.send('retrieveUnreadCount');
}, 1000);

var showUnreadBadge = function(unreadCount) {
  switch (process.platform) {
    case 'win32':
      var window = remote.getCurrentWindow();
      if (unreadCount > 0) {
        window.setOverlayIcon(__dirname + '/resources/badge.png', 'You have unread channels.');
      }
      else {
        window.setOverlayIcon(null, '');
      }
      break;
    case 'darwin':
      if (unreadCount > 0) {
        remote.app.dock.setBadge(unreadCount.toString());
      }
      else {
        remote.app.dock.setBadge('');
      }
      break;
    default:
  }
}

webView.addEventListener('ipc-message', function(event) {
  switch (event.channel) {
    case 'retrieveUnreadCount':
      var unreadCount = event.args[0];
      showUnreadBadge(unreadCount);
      break;
  }
});
