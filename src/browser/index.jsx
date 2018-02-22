'use strict';

require('./css/index.css');

window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
  throw new Error('Sorry, Mattermost does not support window.eval() for security reasons.');
};

const url = require('url');

const React = require('react');
const ReactDOM = require('react-dom');
const {remote, ipcRenderer} = require('electron');

const buildConfig = require('../common/config/buildConfig');
const settings = require('../common/settings');
const utils = require('../utils/util');

const MainPage = require('./components/MainPage.jsx');
const AppConfig = require('./config/AppConfig.js');
const badge = require('./js/badge');

const teams = settings.mergeDefaultTeams(AppConfig.data.teams);

remote.getCurrentWindow().removeAllListeners('focus');

if (teams.length === 0) {
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
      mentionCount,
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
    mentionCount,
  });
}

function showUnreadBadgeLinux(unreadCount, mentionCount) {
  if (remote.app.isUnityRunning()) {
    remote.app.setBadgeCount(mentionCount);
  }

  ipcRenderer.send('update-unread', {
    unreadCount,
    mentionCount,
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

const permissionRequestQueue = [];
const requestingPermission = new Array(AppConfig.data.teams.length);

function teamConfigChange(updatedTeams) {
  AppConfig.set('teams', updatedTeams.slice(buildConfig.defaultTeams.length));
  teams.splice(0, teams.length, ...updatedTeams);
  requestingPermission.length = teams.length;
  ipcRenderer.send('update-menu', AppConfig.data);
  ipcRenderer.send('update-config');
}

function feedPermissionRequest() {
  const webviews = document.getElementsByTagName('webview');
  const webviewOrigins = Array.from(webviews).map((w) => utils.getDomain(w.getAttribute('src')));
  for (let index = 0; index < requestingPermission.length; index++) {
    if (requestingPermission[index]) {
      break;
    }
    for (const request of permissionRequestQueue) {
      if (request.origin === webviewOrigins[index]) {
        requestingPermission[index] = request;
        break;
      }
    }
  }
}

function handleClickPermissionDialog(index, status) {
  const requesting = requestingPermission[index];
  ipcRenderer.send('update-permission', requesting.origin, requesting.permission, status);
  if (status === 'allow' || status === 'block') {
    const newRequests = permissionRequestQueue.filter((request) => {
      if (request.permission === requesting.permission && request.origin === requesting.origin) {
        return false;
      }
      return true;
    });
    permissionRequestQueue.splice(0, permissionRequestQueue.length, ...newRequests);
  } else if (status === 'close') {
    const i = permissionRequestQueue.findIndex((e) => e.permission === requesting.permission && e.origin === requesting.origin);
    permissionRequestQueue.splice(i, 1);
  }
  requestingPermission[index] = null;
  feedPermissionRequest();
}

ipcRenderer.on('request-permission', (event, origin, permission) => {
  if (permissionRequestQueue.length >= 100) {
    return;
  }
  permissionRequestQueue.push({origin, permission});
  feedPermissionRequest();
});

function handleSelectSpellCheckerLocale(locale) {
  console.log(locale);
  AppConfig.set('spellCheckerLocale', locale);
  ipcRenderer.send('update-config');
  ipcRenderer.send('update-dict');
}

const parsedURL = url.parse(window.location.href, true);
const initialIndex = parsedURL.query.index ? parseInt(parsedURL.query.index, 10) : 0;

let deeplinkingUrl = null;
if (!parsedURL.query.index || parsedURL.query.index === null) {
  deeplinkingUrl = remote.getCurrentWindow().deeplinkingUrl;
}

ReactDOM.render(
  <MainPage
    teams={teams}
    initialIndex={initialIndex}
    onUnreadCountChange={showUnreadBadge}
    onTeamConfigChange={teamConfigChange}
    useSpellChecker={AppConfig.data.useSpellChecker}
    onSelectSpellCheckerLocale={handleSelectSpellCheckerLocale}
    deeplinkingUrl={deeplinkingUrl}
    showAddServerButton={buildConfig.enableServerManagement}
    requestingPermission={requestingPermission}
    onClickPermissionDialog={handleClickPermissionDialog}
  />,
  document.getElementById('content')
);

// Deny drag&drop navigation in mainWindow.
// Drag&drop is allowed in webview of index.html.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
