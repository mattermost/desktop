'use strict';

const electron = require('electron');
const ipc = electron.ipcRenderer;
const NativeNotification = Notification;

var hasClass = function(element, className) {
  var rclass = /[\t\r\n\f]/g;
  if ((' ' + element.className + ' ').replace(rclass, ' ').indexOf(className) > -1) {
    return true;
  }
  return false;
};

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
    if (isElementVisible(elem[i]) && !hasClass(elem[i], 'badge-notify')) {
      mentionCount += Number(elem[i].innerHTML);
    }
  }

  var postAttrName = 'data-reactid';
  var lastPostElem = document.querySelector('div[' + postAttrName + '="' + this.lastCheckedPostId + '"]');
  var isUnread = false;
  var isMentioned = false;
  if (lastPostElem === null || !isElementVisible(lastPostElem)) {
    // When load channel or change channel, this.lastCheckedPostId is invalid.
    // So we get latest post and save lastCheckedPostId.

    // find active post-list.
    var postLists = document.querySelectorAll('div.post-list__content');
    if (postLists.length === 0) {
      return;
    }
    var post = null;
    for (var i = 0; i < postLists.length; i++) {
      if (isElementVisible(postLists[i])) {
        post = postLists[i].children[0];
      }
    }
    if (post === null) {
      return;
    }
    // find latest post and save.
    while (post = post.nextSibling) {
      if (post.nextSibling === null) {
        if (post.getAttribute(postAttrName) !== null) {
          this.lastCheckedPostId = post.getAttribute(postAttrName);
        }
      }
    }
  }
  else if (lastPostElem !== null) {
    var newPostElem = lastPostElem;
    while (newPostElem = newPostElem.nextSibling) {
      this.lastCheckedPostId = newPostElem.getAttribute(postAttrName);
      isUnread = true;
      var activeChannel = document.querySelector('.active .sidebar-channel');
      var closeButton = activeChannel.getElementsByClassName('btn-close');
      if (closeButton.length === 1 && closeButton[0].getAttribute('aria-describedby') === 'remove-dm-tooltip') {
        // If active channel is DM, all posts is treated as menion.
        isMentioned = true;
        break;
      }
      else {
        // If active channel is public/private channel, only mentioned post is treated as mention.
        var highlight = newPostElem.getElementsByClassName('mention-highlight');
        if (highlight.length != 0 && isElementVisible(highlight[0])) {
          isMentioned = true;
          break;
        }
      }
    }
  }

  if (this.unreadCount != unreadCount || this.mentionCount != mentionCount || isUnread || isMentioned) {
    ipc.sendToHost('onUnreadCountChange', unreadCount, mentionCount, isUnread, isMentioned);
  }
  this.unreadCount = unreadCount;
  this.mentionCount = mentionCount;
}, 1000);

function isElementVisible(elem) {
  return elem.offsetHeight !== 0;
}

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
  };
  Notification.permission = NativeNotification.permission;
  Notification.requestPermission = function(callback) {
    callback('granted');
  };
  Notification.prototype.close = function() {};
};

// Show window even if it is hidden/minimized when notification is clicked.
function overrideNotification() {
  Notification = function(title, options) {
    this.notification = new NativeNotification(title, options);
  };
  Notification.permission = NativeNotification.permission;
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
