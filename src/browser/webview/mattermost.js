'use strict';

const electron = require('electron');
const ipc = electron.ipcRenderer;
const webFrame = electron.webFrame;

const EnhancedNotification = require('../js/notification');

const UNREAD_COUNT_INTERVAL = 1000;

Notification = EnhancedNotification; // eslint-disable-line no-global-assign, no-native-reassign

Reflect.deleteProperty(global.Buffer); // http://electron.atom.io/docs/tutorial/security/#buffer-global

function isReactAppInitialized() {
  const initializedRoot =
    document.querySelector('#root.channel-view') || // React 16 webapp
    document.querySelector('#root .signup-team__container') || // React 16 login
    document.querySelector('div[data-reactroot]'); // Older React apps
  if (initializedRoot === null) {
    return false;
  }
  return initializedRoot.children.length !== 0;
}

function watchReactAppUntilInitialized(callback) {
  let count = 0;
  const interval = 500;
  const timeout = 30000;
  const timer = setInterval(() => {
    count += interval;
    if (isReactAppInitialized() || count >= timeout) { // assumed as webapp has been initialized.
      clearTimeout(timer);
      callback();
    }
  }, interval);
}

window.addEventListener('load', () => {
  if (document.getElementById('root') === null) {
    console.log('The guest is not assumed as mattermost-webapp');
    ipc.sendToHost('onGuestInitialized');
    return;
  }
  watchReactAppUntilInitialized(() => {
    ipc.sendToHost('onGuestInitialized');
  });
});

function hasClass(element, className) {
  var rclass = /[\t\r\n\f]/g;
  if ((' ' + element.className + ' ').replace(rclass, ' ').indexOf(className) > -1) {
    return true;
  }
  return false;
}

function getUnreadCount() {
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
    setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);
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
      setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);
      return;
    }
    var post = null;
    for (var j = 0; j < postLists.length; j++) {
      if (isElementVisible(postLists[j])) {
        post = postLists[j].children[0];
      }
    }
    if (post === null) {
      setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);
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
  setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);
}
setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);

function isElementVisible(elem) {
  return elem.offsetHeight !== 0;
}

function resetMisspelledState() {
  ipc.once('spellchecker-is-ready', () => {
    const element = document.activeElement;
    if (element) {
      element.blur();
      element.focus();
    }
  });
  ipc.send('reply-on-spellchecker-is-ready');
}

function setSpellChecker() {
  const spellCheckerLocale = ipc.sendSync('get-spellchecker-locale');
  webFrame.setSpellCheckProvider(spellCheckerLocale, false, {
    spellCheck(text) {
      const res = ipc.sendSync('checkspell', text);
      return res === null ? true : res;
    },
  });
  resetMisspelledState();
}
setSpellChecker();
ipc.on('set-spellcheker', setSpellChecker);
