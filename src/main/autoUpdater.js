// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, BrowserWindow, dialog, ipcMain, shell} from 'electron';

import logger from 'electron-log';
import {autoUpdater, CancellationToken} from 'electron-updater';
import semver from 'semver';

// eslint-disable-next-line no-magic-numbers
const UPDATER_INTERVAL_IN_MS = 48 * 60 * 60 * 1000; // 48 hours

autoUpdater.logger = logger;
autoUpdater.logger.transports.file.level = 'info';

let updaterModal = null;

function createEventListener(win, eventName) {
  return (event) => {
    if (event.sender === win.webContents) {
      win.emit(eventName);
    }
  };
}

function createUpdaterModal(parentWindow, options) {
  const windowWidth = 480;
  const windowHeight = 280;
  const windowOptions = {
    title: `${app.name} Updater`,
    parent: parentWindow,
    modal: true,
    maximizable: false,
    show: false,
    width: windowWidth,
    height: windowHeight,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
  };
  if (process.platform === 'linux') {
    windowOptions.icon = options.linuxAppIcon;
  }

  const modal = new BrowserWindow(windowOptions);
  modal.once('ready-to-show', () => {
    modal.show();
  });
  let updaterURL = (global.isDev ? 'http://localhost:8080' : `file://${app.getAppPath()}`) + '/browser/updater.html';

  if (options.notifyOnly) {
    updaterURL += '?notifyOnly=true';
  }
  modal.loadURL(updaterURL);

  for (const eventName of ['click-release-notes', 'click-skip', 'click-remind', 'click-install', 'click-download', 'click-cancel']) {
    const listener = createEventListener(modal, eventName);
    ipcMain.on(eventName, listener);
    modal.on('closed', () => {
      ipcMain.removeListener(eventName, listener);
    });
  }

  return modal;
}

function isUpdateApplicable(now, skippedVersion, updateInfo) {
  const releaseTime = new Date(updateInfo.releaseDate).getTime();

  // 48 hours after a new version is added to releases.mattermost.com, user receives a “New update is available” dialog
  if (now.getTime() - releaseTime < UPDATER_INTERVAL_IN_MS) {
    return false;
  }

  // If a version was skipped, compare version.
  if (skippedVersion) {
    return semver.gt(updateInfo.version, skippedVersion);
  }

  return true;
}

function downloadAndInstall(cancellationToken) {
  autoUpdater.on('update-downloaded', () => {
    global.willAppQuit = true;
    autoUpdater.quitAndInstall();
  });
  autoUpdater.downloadUpdate(cancellationToken);
}

function initialize(appState, mainWindow, notifyOnly = false) {
  autoUpdater.autoDownload = false; // To prevent upgrading on quit
  const assetsDir = path.resolve(app.getAppPath(), 'assets');
  autoUpdater.on('error', (err) => {
    console.error('Error in autoUpdater:', err.message);
  }).on('update-available', (info) => {
    let cancellationToken = null;
    if (isUpdateApplicable(new Date(), appState.skippedVersion, info)) {
      updaterModal = createUpdaterModal(mainWindow, {
        linuxAppIcon: path.join(assetsDir, 'appicon.png'),
        notifyOnly,
      });
      updaterModal.on('closed', () => {
        updaterModal = null;
      });
      updaterModal.on('click-skip', () => {
        appState.skippedVersion = info.version;
        updaterModal.close();
      }).on('click-remind', () => {
        appState.updateCheckedDate = new Date();
        setTimeout(() => { // eslint-disable-line max-nested-callbacks
          autoUpdater.checkForUpdates();
        }, UPDATER_INTERVAL_IN_MS);
        updaterModal.close();
      }).on('click-install', () => {
        updaterModal.webContents.send('start-download');
        autoUpdater.signals.progress((data) => { // eslint-disable-line max-nested-callbacks
          updaterModal.send('progress', Math.floor(data.percent));
          console.log('progress:', data);
        });
        cancellationToken = new CancellationToken();
        downloadAndInstall(cancellationToken);
      }).on('click-download', () => {
        shell.openExternal('https://about.mattermost.com/download/#mattermostApps');
      }).on('click-release-notes', () => {
        shell.openExternal(`https://github.com/mattermost/desktop/releases/v${info.version}`);
      }).on('click-cancel', () => {
        cancellationToken.cancel();
        updaterModal.close();
      });
      updaterModal.focus();
    } else if (autoUpdater.isManual) {
      autoUpdater.emit('update-not-available');
    }
  }).on('update-not-available', () => {
    if (autoUpdater.isManual) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Close'],
        title: 'Your Desktop App is up to date',
        message: 'You have the latest version of the Mattermost Desktop App.',
      });
    }
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, UPDATER_INTERVAL_IN_MS);
  });
}

function shouldCheckForUpdatesOnStart(updateCheckedDate) {
  if (updateCheckedDate) {
    if (Date.now() - updateCheckedDate.getTime() < UPDATER_INTERVAL_IN_MS) {
      return false;
    }
  }
  return true;
}

function checkForUpdates(isManual = false) {
  autoUpdater.isManual = isManual;
  if (!updaterModal) {
    autoUpdater.checkForUpdates();
  }
}

class AutoUpdaterConfig {
  constructor() {
    this.data = {};
  }

  isNotifyOnly() {
    if (process.platform === 'win32') {
      return true;
    }
    if (this.data.notifyOnly === true) {
      return true;
    }
    return false;
  }
}

function loadConfig() {
  return new AutoUpdaterConfig();
}

export default {
  UPDATER_INTERVAL_IN_MS,
  checkForUpdates,
  shouldCheckForUpdatesOnStart,
  initialize,
  loadConfig,
};
