const {app, BrowserWindow, dialog, ipcMain, shell} = require('electron');
const path = require('path');
const {autoUpdater} = require('electron-updater');
const semver = require('semver');

const INTERVAL_48_HOURS_IN_MS = 172800000; // 48 * 60 * 60 * 1000 [ms]

let updaterWindow = null;

function setEvent(win, eventName) {
  ipcMain.on(eventName, (event) => {
    if (event.sender === win.webContents) {
      win.emit(eventName);
    }
  });
}

function createUpdaterWindow(options) {
  const windowWidth = 480;
  const windowHeight = 240;
  const windowOptions = {
    title: `${app.getName()} Updater`,
    maximizable: false,
    show: false,
    width: windowWidth,
    height: windowHeight,
    resizable: false,
    autoHideMenuBar: true
  };
  if (process.platform === 'linux') {
    windowOptions.icon = options.linuxAppIcon;
  }

  const win = new BrowserWindow(windowOptions);
  win.once('ready-to-show', () => {
    win.show();
  });
  const updaterURL = (global.isDev ? 'http://localhost:8080' : `file://${app.getAppPath()}`) + '/browser/updater.html';
  win.loadURL(updaterURL);

  setEvent(win, 'click-release-notes');
  setEvent(win, 'click-skip');
  setEvent(win, 'click-remind');
  setEvent(win, 'click-install');

  return win;
}

function isUpdateApplicable(now, skippedVersion, updateInfo) {
  const releaseTime = new Date(updateInfo.releaseDate).getTime();

  // 48 hours after a new version is added to releases.mattermost.com, user receives a “New update is available” dialog
  if (now.getTime() - releaseTime < INTERVAL_48_HOURS_IN_MS) {
    return false;
  }

  // If a version was skipped, compare version.
  if (skippedVersion) {
    return semver.gt(updateInfo.version, skippedVersion);
  }

  return true;
}

function downloadAndInstall() {
  autoUpdater.downloadUpdate().then(() => {
    autoUpdater.quitAndInstall();
  });
}

function initialize(appState, mainWindow) {
  const assetsDir = path.resolve(app.getAppPath(), 'assets');
  autoUpdater.on('error', (err) => {
    console.error('Error in autoUpdater:', err.message);
  }).on('update-available', (info) => {
    if (isUpdateApplicable(new Date(), appState.skippedVersion, info)) {
      updaterWindow = createUpdaterWindow({linuxAppIcon: path.join(assetsDir, 'appicon.png'), nextVersion: '0.0.0'});
      updaterWindow.on('close', () => {
        updaterWindow = null;
      });
      updaterWindow.on('click-skip', () => {
        appState.skippedVersion = info.version;
        updaterWindow.close();
      }).on('click-remind', () => {
        appState.updateCheckedDate = new Date();
        setTimeout(autoUpdater.checkForUpdates, INTERVAL_48_HOURS_IN_MS);
        updaterWindow.close();
      }).on('click-install', () => {
        downloadAndInstall();
        updaterWindow.close();
      }).on('click-release-notes', () => {
        shell.openExternal(`https://github.com/mattermost/desktop/releases/v${info.version}`);
      });
      updaterWindow.focus();
    } else if (autoUpdater.isManual) {
      autoUpdater.emit('update-not-available');
    }
  }).on('update-not-available', () => {
    if (autoUpdater.isManual) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Close'],
        title: 'Your Desktop App is up to date',
        message: 'You have the latest version of the Mattermost Desktop App.'
      }, () => {}); // eslint-disable-line no-empty-function
    }
    setTimeout(autoUpdater.checkForUpdates, INTERVAL_48_HOURS_IN_MS);
  });
}

function shouldCheckForUpdatesOnStart(updateCheckedDate) {
  if (updateCheckedDate) {
    if (Date.now() - updateCheckedDate < INTERVAL_48_HOURS_IN_MS) {
      return false;
    }
  }
  return true;
}

function checkForUpdates(isManual = false) {
  autoUpdater.isManual = isManual;
  autoUpdater.autoDownload = false;
  if (!updaterWindow) {
    autoUpdater.checkForUpdates();
  }
}

module.exports = {
  INTERVAL_48_HOURS_IN_MS,
  checkForUpdates,
  shouldCheckForUpdatesOnStart,
  initialize
};
