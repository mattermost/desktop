'use strict';

const electron = require('electron');
const ipc = electron.ipcRenderer;
const NativeNotification = Notification;

var unreadCountTimer = setInterval(function() {
  if (!this.unreadCount) {
    this.unreadCount = 0;
  }
  if (!this.mentionCount) {
    this.mentionCount = 0;
  }

  // unreadCount in sidebar
  // Note: the active channel doesn't have '.unread-title'.
  var unreadCount = document.getElementsByClassName('unread-title').length;
  // mentionCount in sidebar
  var elem = document.getElementsByClassName('badge')
  var mentionCount = 0;
  for (var i = 0; i < elem.length; i++) {
    if (elem[i].offsetHeight != 0) {
      mentionCount++;
    }
  }

  if (this.unreadCount != unreadCount || this.mentionCount != mentionCount) {
    ipc.sendToHost('onUnreadCountChange', unreadCount, mentionCount);
  }
  this.unreadCount = unreadCount;
  this.mentionCount = mentionCount;
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

var lastUnread = {};

// Show window even if it is hidden/minimized when notification is clicked.
function overrideNotification() {
  Notification = function(title, options) {
    this.notification = new NativeNotification(title, options);

    // Send notification event at active channel.
    var activeChannel = document.querySelector('.active .sidebar-channel').text;
    console.log(activeChannel);
    console.log(title);

    // mentionCount for active channel
    var newSeparators = document.getElementsByClassName('new-separator');
    var post;
    var isMentioned = false;
    // Skip until real new-separator appear.
    for (var i = 0; i < newSeparators.length; i++) {
      if (newSeparators[i].offsetParent !== null) {
        post = newSeparators[i];
      }
    }

    // If active channel is DM, all posts is treated as menion.
    if (activeChannel === title + "×") {
      isMentioned = true;
    }
    else {
      // If active channel is CHANNEL, only .mention-highlight post is treated as mention.
      if (post != null) {
        // Skip posts until last unread.
        if (activeChannel === title && lastUnread.channel === title && lastUnread.post !== null) {
          var firstPost = post;
          while (post = post.nextSibling) {
            if (lastUnread.post === post.getAttribute('data-reactid')) {
              break;
            }
          }
          // Because last unread post not found, set first post.
          if (post === null) {
            post = firstPost;
          }
        }

        while (post = post.nextSibling) {
          var highlight = post.getElementsByClassName('mention-highlight');
          if (highlight.length != 0 && highlight[0].offsetHeight != null) {
            isMentioned = true;
          }

          // Remember last unread post.
          if (post.nextSibling === null) {
            lastUnread.post = post.getAttribute('data-reactid');
            lastUnread.channel = title;
          }
        }
      }
    }

    // Note: DM title is "{username}×". CHANNEL title is "{channel_title}".
    if (activeChannel === title || activeChannel === title + "×") {
      ipc.sendToHost('onActiveChannelNotify', isMentioned);
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
