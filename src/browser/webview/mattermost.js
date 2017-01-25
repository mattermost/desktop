'use strict';

const electron = require('electron');
const ipc = electron.ipcRenderer;
const notification = require('../js/notification');

window.eval = global.eval = () => {
  throw new Error('Sorry, Mattermost does not support window.eval() for security reasons.');
};

Reflect.deleteProperty(global.Buffer); // http://electron.atom.io/docs/tutorial/security/#buffer-global

function hasClass(element, className) {
  var rclass = /[\t\r\n\f]/g;
  if ((' ' + element.className + ' ').replace(rclass, ' ').indexOf(className) > -1) {
    return true;
  }
  return false;
}

setInterval(function getUnreadCount() {
  if (!this.unreadCount) {
    this.unreadCount = 0;
  }
  if (!this.mentionCount) {
    this.mentionCount = 0;
  }

  // LHS not found => Log out => Count should be 0.
  if (document.getElementById('sidebar-left') === null) {
    ipc.sendToHost('onUnreadCountChange', 0, 0, false, false);
    this.unreadCount = 0;
    this.mentionCount = 0;
    return;
  }

  // unreadCount in sidebar
  // Note: the active channel doesn't have '.unread-title'.
  var unreadCount = document.getElementsByClassName('unread-title').length;

  // unreadCount in team sidebar
  const teamSideBar = document.getElementsByClassName('team-sidebar'); // team-sidebar doesn't have id
  if (teamSideBar.length === 1) {
    unreadCount += teamSideBar[0].getElementsByClassName('unread').length;
  }

  // mentionCount in sidebar
  var elem = document.getElementsByClassName('badge');
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
    for (var j = 0; j < postLists.length; j++) {
      if (isElementVisible(postLists[j])) {
        post = postLists[j].children[0];
      }
    }
    if (post === null) {
      return;
    }

    // find latest post and save.
    post = post.nextSibling;
    while (post) {
      if (post.nextSibling === null) {
        if (post.getAttribute(postAttrName) !== null) {
          this.lastCheckedPostId = post.getAttribute(postAttrName);
        }
      }
      post = post.nextSibling;
    }
  } else if (lastPostElem !== null) {
    var newPostElem = lastPostElem.nextSibling;
    while (newPostElem) {
      this.lastCheckedPostId = newPostElem.getAttribute(postAttrName);
      isUnread = true;
      var activeChannel = document.querySelector('.active .sidebar-channel');
      var closeButton = activeChannel.getElementsByClassName('btn-close');
      if (closeButton.length === 1 && closeButton[0].getAttribute('aria-describedby') === 'remove-dm-tooltip') {
        // If active channel is DM, all posts is treated as menion.
        isMentioned = true;
        break;
      } else {
        // If active channel is public/private channel, only mentioned post is treated as mention.
        var highlight = newPostElem.getElementsByClassName('mention-highlight');
        if (highlight.length !== 0 && isElementVisible(highlight[0])) {
          isMentioned = true;
          break;
        }
      }
      newPostElem = newPostElem.nextSibling;
    }
  }

  if (this.unreadCount !== unreadCount || this.mentionCount !== mentionCount || isUnread || isMentioned) {
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
  notification(title, options) {
    ipc.send('notified', {
      title,
      options
    });
  },

  // Show window even if it is hidden/minimized when notification is clicked.
  onclick() {
    const currentWindow = electron.remote.getCurrentWindow();
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
    ipc.sendToHost('onNotificationClick');
  }
});

// get the last of href for the current channel in the sidebar.
function getCurrentChannelString() {
  const activeChannelLink = document.querySelector('.active a.sidebar-channel');
  const urlElements = activeChannelLink.href.split('/');
  return urlElements[urlElements.length - 1];
}

ipc.on('activate-search-box', () => {
  const searchBoxes = document.getElementsByClassName('search-bar'); // should use id
  if (searchBoxes.length === 0) {
    return;
  }
  const searchBox = searchBoxes[0];
  searchBox.focus();
  searchBox.value = ''; //Clear the input box
});

ipc.on('activate-search-box-in-channel', () => {
  const searchBoxes = document.getElementsByClassName('search-bar'); // should use id
  if (searchBoxes.length === 0) {
    return;
  }
  const searchBox = searchBoxes[0];
  searchBox.focus();
  searchBox.value = `in:${getCurrentChannelString()} `;
});
