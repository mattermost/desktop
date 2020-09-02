// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

/* eslint-disable no-magic-numbers */

import {ipcRenderer, webFrame, remote} from 'electron';

const UNREAD_COUNT_INTERVAL = 1000;
const CLEAR_CACHE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

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
    ipcRenderer.sendToHost('onGuestInitialized');
    return;
  }
  watchReactAppUntilInitialized(() => {
    ipcRenderer.sendToHost('onGuestInitialized', window.basename);
  });
});

// Sent for drag and drop tabs to work properly
document.addEventListener('mousemove', (event) => {
  ipcRenderer.sendToHost('mouse-move', {clientX: event.clientX, clientY: event.clientY});
});

document.addEventListener('mouseup', () => {
  ipcRenderer.sendToHost('mouse-up');
});

// listen for messages from the webapp
window.addEventListener('message', ({origin, data: {type, message = {}} = {}} = {}) => {
  if (origin !== window.location.origin) {
    return;
  }
  switch (type) {
  case 'webapp-ready': {
    // register with the webapp to enable custom integration functionality
    window.postMessage(
      {
        type: 'register-desktop',
        message: {
          version: remote.app.getVersion(),
        },
      },
      window.location.origin || '*'
    );
    break;
  }
  case 'dispatch-notification': {
    const {title, body, channel, teamId, silent, data} = message;
    ipcRenderer.sendToHost('dispatchNotification', title, body, channel, teamId, silent, data, () => handleNotificationClick({teamId, channel}));
    break;
  }
  }
});

const handleNotificationClick = ({channel, teamId}) => {
  window.postMessage(
    {
      type: 'notification-clicked',
      message: {
        channel,
        teamId,
      },
    },
    window.location.origin
  );
};

ipcRenderer.on('notification-clicked', (event, {channel, teamId}) => {
  handleNotificationClick({channel, teamId});
});

function hasClass(element, className) {
  const rclass = /[\t\r\n\f]/g;
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

  // LHS not found => Log out => Count should be 0, but session may be expired.
  if (document.getElementById('sidebar-left') === null) {
    const extraParam = (new URLSearchParams(window.location.search)).get('extra');
    const sessionExpired = extraParam === 'expired';

    ipcRenderer.sendToHost('onBadgeChange', sessionExpired, 0, 0, false, false);
    this.sessionExpired = sessionExpired;
    this.unreadCount = 0;
    this.mentionCount = 0;
    setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);
    return;
  }

  // unreadCount in sidebar
  // Note: the active channel doesn't have '.unread-title'.
  let unreadCount = document.getElementsByClassName('unread-title').length;

  // unreadCount in team sidebar
  const teamSideBar = document.getElementsByClassName('team-sidebar'); // team-sidebar doesn't have id
  if (teamSideBar.length === 1) {
    unreadCount += teamSideBar[0].getElementsByClassName('unread').length;
  }

  // mentionCount in sidebar
  const elem = document.querySelectorAll('#sidebar-left .badge, #channel_view .badge');
  let mentionCount = 0;
  for (let i = 0; i < elem.length; i++) {
    if (isElementVisible(elem[i]) && !hasClass(elem[i], 'badge-notify')) {
      mentionCount += Number(elem[i].innerHTML);
    }
  }

  const postAttrName = 'data-reactid';
  const lastPostElem = document.querySelector('div[' + postAttrName + '="' + this.lastCheckedPostId + '"]');
  let isUnread = false;
  let isMentioned = false;
  if (lastPostElem === null || !isElementVisible(lastPostElem)) {
    // When load channel or change channel, this.lastCheckedPostId is invalid.
    // So we get latest post and save lastCheckedPostId.

    // find active post-list.
    const postLists = document.querySelectorAll('div.post-list__content');
    if (postLists.length === 0) {
      setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);
      return;
    }
    let post = null;
    for (let j = 0; j < postLists.length; j++) {
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
    let newPostElem = lastPostElem.nextSibling;
    while (newPostElem) {
      this.lastCheckedPostId = newPostElem.getAttribute(postAttrName);
      isUnread = true;
      const activeChannel = document.querySelector('.active .sidebar-channel');
      const closeButton = activeChannel.getElementsByClassName('btn-close');
      if (closeButton.length === 1 && closeButton[0].getAttribute('aria-describedby') === 'remove-dm-tooltip') {
        // If active channel is DM, all posts is treated as mention.
        isMentioned = true;
        break;
      } else {
        // If active channel is public/private channel, only mentioned post is treated as mention.
        const highlight = newPostElem.getElementsByClassName('mention-highlight');
        if (highlight.length !== 0 && isElementVisible(highlight[0])) {
          isMentioned = true;
          break;
        }
      }
      newPostElem = newPostElem.nextSibling;
    }
  }

  if (this.sessionExpired || this.unreadCount !== unreadCount || this.mentionCount !== mentionCount || isUnread || isMentioned) {
    ipcRenderer.sendToHost('onBadgeChange', false, unreadCount, mentionCount, isUnread, isMentioned);
  }
  this.unreadCount = unreadCount;
  this.mentionCount = mentionCount;
  this.sessionExpired = false;
  setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);
}
setTimeout(getUnreadCount, UNREAD_COUNT_INTERVAL);

function isElementVisible(elem) {
  return elem.offsetHeight !== 0;
}

function resetMisspelledState() {
  ipcRenderer.once('spellchecker-is-ready', () => {
    const element = document.activeElement;
    if (element) {
      element.blur();
      element.focus();
    }
  });
  ipcRenderer.send('reply-on-spellchecker-is-ready');
}

function setSpellChecker() {
  const spellCheckerLocale = ipcRenderer.sendSync('get-spellchecker-locale');
  webFrame.setSpellCheckProvider(spellCheckerLocale, {
    spellCheck(words, callback) {
      const misspeltWords = words.filter((text) => {
        const res = ipcRenderer.sendSync('checkspell', text);
        const isCorrect = (res === null) ? true : res;
        return !isCorrect;
      });
      callback(misspeltWords);
    },
  });
  resetMisspelledState();
}
setSpellChecker();
ipcRenderer.on('set-spellchecker', setSpellChecker);

// push user activity updates to the webapp
ipcRenderer.on('user-activity-update', (event, {userIsActive, isSystemEvent}) => {
  if (window.location.origin !== 'null') {
    window.postMessage({type: 'user-activity-update', message: {userIsActive, manual: isSystemEvent}}, window.location.origin);
  }
});

// exit fullscreen embedded elements like youtube - https://mattermost.atlassian.net/browse/MM-19226
ipcRenderer.on('exit-fullscreen', () => {
  if (document.fullscreenElement && document.fullscreenElement.nodeName.toLowerCase() === 'iframe') {
    document.exitFullscreen();
  }
});

// mattermost-webapp is SPA. So cache is not cleared due to no navigation.
// We needed to manually clear cache to free memory in long-term-use.
// http://seenaburns.com/debugging-electron-memory-usage/
setInterval(() => {
  webFrame.clearCache();
}, CLEAR_CACHE_INTERVAL);

/* eslint-enable no-magic-numbers */
