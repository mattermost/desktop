'use strict';

const electron = require('electron');
const ipc = electron.ipcRenderer;
const notification = require('../js/notification');

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

notification.override({
  // Send a notification event to the main process.
  notification: function(title, options) {
    ipc.send('notified', {
      title: title,
      options: options
    });
  },
  // Show window even if it is hidden/minimized when notification is clicked.
  onclick: function() {
    const currentWindow = electron.remote.getCurrentWindow();
    if (process.platform === 'win32') {
      // show() breaks Aero Snap state.
      if (currentWindow.isVisible()) {
        currentWindow.focus();
      }
      else {
        currentWindow.show();
      }
    }
    else {
      currentWindow.show();
    }
    ipc.sendToHost('onNotificationClick');
  }
});
