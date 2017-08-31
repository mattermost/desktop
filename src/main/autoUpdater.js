const {app, BrowserWindow, dialog, ipcMain, shell} = require('electron');
const path = require('path');
const {autoUpdater} = require('electron-updater');
const semver = require('semver');

const interval48hours = 172800000; // 48 * 60 * 60 * 1000

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

function isUpdateApplicable(appState, updateInfo) {
  if (appState.updateCheckedDate.value - (new Date(updateInfo.releaseDate)).value < interval48hours) {
    return false;
  }
  return (appState.skippedVersion !== null) && semver.gt(updateInfo.version, appState.skippedVersion);
}

function initialize(appState, mainWindow) {
  const assetsDir = path.resolve(app.getAppPath(), 'assets');
  autoUpdater.on('error', (err) => {
    console.error('Error in autoUpdater:', err.message);
  }).on('checking-for-update', () => {
    appState.updateCheckedDate = new Date();
  }).on('update-available', (info) => {
    if (isUpdateApplicable(appState, info)) {
      updaterWindow = createUpdaterWindow({linuxAppIcon: path.join(assetsDir, 'appicon.png'), nextVersion: '0.0.0'});
      updaterWindow.on('close', () => {
        updaterWindow = null;
      });
      updaterWindow.on('click-skip', () => {
        appState.skippedVersion = info.version;
        updaterWindow.close();
      }).on('click-remind', () => {
        setTimeout(autoUpdater.checkForUpdates, interval48hours);
        updaterWindow.close();
      }).on('click-install', () => {
        autoUpdater.quitAndInstall();
        updaterWindow.close();
      }).on('click-release-notes', () => {
        shell.openExternal(`https://github.com/mattermost/desktop/releases/v${info.version}`);
      });
    }
  }).on('update-not-available', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Close'],
      title: 'Your Desktop App is up to date',
      message: 'You have the latest version of the Mattermost Desktop App.'
    }, () => {}); // eslint-disable-line no-empty-function
    setTimeout(autoUpdater.checkForUpdates, interval48hours);
  });
}

function checkForUpdates() {
  if (!updaterWindow) {
    autoUpdater.checkForUpdates();
  }
}

module.exports = {
  checkForUpdates,
  initialize
};
