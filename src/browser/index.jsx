'use strict';

require('./css/index.css');

window.eval = global.eval = () => {
  throw new Error('Sorry, Mattermost does not support window.eval() for security reasons.');
};

const React = require('react');
const ReactDOM = require('react-dom');
const {remote, ipcRenderer} = require('electron');
const MainPage = require('./components/MainPage.jsx');

const AppConfig = require('./config/AppConfig.js');
const url = require('url');

const badge = require('./js/badge');

remote.getCurrentWindow().removeAllListeners('focus');

if (AppConfig.data.teams.length === 0) {
  window.location = 'settings.html';
}

function showUnreadBadgeWindows(unreadCount, mentionCount) {
  function sendBadge(dataURL, description) {
    // window.setOverlayIcon() does't work with NativeImage across remote boundaries.
    // https://github.com/atom/electron/issues/4011
    ipcRenderer.send('update-unread', {
      overlayDataURL: dataURL,
      description,
      unreadCount,
      mentionCount
    });
  }

  if (mentionCount > 0) {
    const dataURL = badge.createDataURL(mentionCount.toString());
    sendBadge(dataURL, 'You have unread mentions (' + mentionCount + ')');
  } else if (unreadCount > 0 && AppConfig.data.showUnreadBadge) {
    const dataURL = badge.createDataURL('•');
    sendBadge(dataURL, 'You have unread channels (' + unreadCount + ')');
  } else {
    sendBadge(null, 'You have no unread messages');
  }
}

function showUnreadBadgeOSX(unreadCount, mentionCount) {
  if (mentionCount > 0) {
    remote.app.dock.setBadge(mentionCount.toString());
  } else if (unreadCount > 0 && AppConfig.data.showUnreadBadge) {
    remote.app.dock.setBadge('•');
  } else {
    remote.app.dock.setBadge('');
  }

  ipcRenderer.send('update-unread', {
    unreadCount,
    mentionCount
  });
}

function showUnreadBadgeLinux(unreadCount, mentionCount) {
  if (remote.app.isUnityRunning()) {
    remote.app.setBadgeCount(mentionCount);
  }

  ipcRenderer.send('update-unread', {
    unreadCount,
    mentionCount
  });
}

function showUnreadBadge(unreadCount, mentionCount) {
  switch (process.platform) {
  case 'win32':
    showUnreadBadgeWindows(unreadCount, mentionCount);
    break;
  case 'darwin':
    showUnreadBadgeOSX(unreadCount, mentionCount);
    break;
  case 'linux':
    showUnreadBadgeLinux(unreadCount, mentionCount);
    break;
  default:
  }
}

function teamConfigChange(teams) {
  AppConfig.set('teams', teams);
  ipcRenderer.send('update-menu', AppConfig.data);
  ipcRenderer.send('update-config');
}

function handleSelectSpellCheckerLocale(locale) {
  console.log(locale);
  AppConfig.set('spellCheckerLocale', locale);
  ipcRenderer.send('update-config');
  ipcRenderer.send('update-dict');
}

const parsedURL = url.parse(window.location.href, true);
const initialIndex = parsedURL.query.index ? parseInt(parsedURL.query.index, 10) : 0;

ReactDOM.render(
  <MainPage
    teams={AppConfig.data.teams}
    initialIndex={initialIndex}
    onUnreadCountChange={showUnreadBadge}
    onTeamConfigChange={teamConfigChange}
    useSpellChecker={AppConfig.data.useSpellChecker}
    onSelectSpellCheckerLocale={handleSelectSpellCheckerLocale}
  />,
  document.getElementById('content')
);

// Deny drag&drop navigation in mainWindow.
// Drag&drop is allowed in webview of index.html.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
