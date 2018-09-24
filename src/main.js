// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import os from 'os';
import path from 'path';

import electron from 'electron';
const {
  app,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  dialog,
  systemPreferences,
  session,
} = electron;
import isDev from 'electron-is-dev';
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';
import {parse as parseArgv} from 'yargs';

import {protocols} from '../electron-builder.json';

import squirrelStartup from './main/squirrelStartup';
import AutoLauncher from './main/AutoLauncher';
import CriticalErrorHandler from './main/CriticalErrorHandler';

const criticalErrorHandler = new CriticalErrorHandler();

process.on('uncaughtException', criticalErrorHandler.processUncaughtExceptionHandler.bind(criticalErrorHandler));

global.willAppQuit = false;

app.setAppUserModelId('com.squirrel.mattermost.Mattermost'); // Use explicit AppUserModelID
if (squirrelStartup(() => {
  app.quit();
})) {
  global.willAppQuit = true;
}
import settings from './common/settings';
import CertificateStore from './main/certificateStore';
const certificateStore = CertificateStore.load(path.resolve(app.getPath('userData'), 'certificate.json'));
import createMainWindow from './main/mainWindow';
import appMenu from './main/menus/app';
import trayMenu from './main/menus/tray';
import downloadURL from './main/downloadURL';
import allowProtocolDialog from './main/allowProtocolDialog';
import PermissionManager from './main/PermissionManager';
import permissionRequestHandler from './main/permissionRequestHandler';
import AppStateManager from './main/AppStateManager';
import initCookieManager from './main/cookieManager';
import {shouldBeHiddenOnStartup} from './main/utils';

import SpellChecker from './main/SpellChecker';

const assetsDir = path.resolve(app.getAppPath(), 'assets');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let spellChecker = null;
let deeplinkingUrl = null;
let scheme = null;
let appState = null;
let permissionManager = null;

const argv = parseArgv(process.argv.slice(1));
const hideOnStartup = shouldBeHiddenOnStartup(argv);

if (argv['data-dir']) {
  app.setPath('userData', path.resolve(argv['data-dir']));
}

global.isDev = isDev && !argv.disableDevMode;

let config = {};
try {
  const configFile = app.getPath('userData') + '/config.json';
  config = settings.readFileSync(configFile);
  if (config.version !== settings.version) {
    config = settings.upgrade(config);
    settings.writeFileSync(configFile, config);
  }
} catch (e) {
  config = settings.loadDefault();
  console.log('Failed to read or upgrade config.json', e);
  if (!config.teams.length && config.defaultTeam) {
    config.teams.push(config.defaultTeam);

    const configFile = app.getPath('userData') + '/config.json';
    settings.writeFileSync(configFile, config);
  }
}
if (config.enableHardwareAcceleration === false) {
  app.disableHardwareAcceleration();
}

ipcMain.on('update-config', () => {
  const configFile = app.getPath('userData') + '/config.json';
  config = settings.readFileSync(configFile);
  if (process.platform === 'win32' || process.platform === 'linux') {
    const appLauncher = new AutoLauncher();
    const autoStartTask = config.autostart ? appLauncher.enable() : appLauncher.disable();
    autoStartTask.then(() => {
      console.log('config.autostart has been configured:', config.autostart);
    }).catch((err) => {
      console.log('error:', err);
    });
  }
  const trustedURLs = settings.mergeDefaultTeams(config.teams).map((team) => team.url);
  permissionManager.setTrustedURLs(trustedURLs);
  ipcMain.emit('update-dict', true, config.spellCheckerLocale);
});

// Only for OS X
function switchMenuIconImages(icons, isDarkMode) {
  if (isDarkMode) {
    icons.normal = icons.clicked.normal;
    icons.unread = icons.clicked.unread;
    icons.mention = icons.clicked.mention;
  } else {
    icons.normal = icons.light.normal;
    icons.unread = icons.light.unread;
    icons.mention = icons.light.mention;
  }
}

let trayIcon = null;
const trayImages = (() => {
  switch (process.platform) {
  case 'win32':
    return {
      normal: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray.ico')),
      unread: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray_unread.ico')),
      mention: nativeImage.createFromPath(path.resolve(assetsDir, 'windows/tray_mention.ico')),
    };
  case 'darwin':
  {
    const icons = {
      light: {
        normal: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIcon.png')),
        unread: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIconUnread.png')),
        mention: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/MenuIconMention.png')),
      },
      clicked: {
        normal: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIcon.png')),
        unread: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIconUnread.png')),
        mention: nativeImage.createFromPath(path.resolve(assetsDir, 'osx/ClickedMenuIconMention.png')),
      },
    };
    switchMenuIconImages(icons, systemPreferences.isDarkMode());
    return icons;
  }
  case 'linux':
  {
    const theme = config.trayIconTheme;
    try {
      return {
        normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconTemplate.png')),
        unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconUnreadTemplate.png')),
        mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', theme, 'MenuIconMentionTemplate.png')),
      };
    } catch (e) {
      //Fallback for invalid theme setting
      return {
        normal: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconTemplate.png')),
        unread: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconUnreadTemplate.png')),
        mention: nativeImage.createFromPath(path.resolve(assetsDir, 'linux', 'light', 'MenuIconMentionTemplate.png')),
      };
    }
  }
  default:
    return {};
  }
})();

// If there is already an instance, activate the window in the existing instace and quit this one
if (app.makeSingleInstance((commandLine/*, workingDirectory*/) => {
  // Protocol handler for win32
  // argv: An array of the second instance’s (command line / deep linked) arguments
  if (process.platform === 'win32') {
    // Keep only command line / deep linked arguments
    if (Array.isArray(commandLine.slice(1)) && commandLine.slice(1).length > 0) {
      setDeeplinkingUrl(commandLine.slice(1)[0]);
      mainWindow.webContents.send('protocol-deeplink', deeplinkingUrl);
    }
  }

  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    } else {
      mainWindow.show();
    }
  }
})) {
  app.exit();
}

function shouldShowTrayIcon() {
  if (process.platform === 'win32') {
    return true;
  }
  if (['darwin', 'linux'].includes(process.platform) && config.showTrayIcon === true) {
    return true;
  }
  return false;
}

function wasUpdated(lastAppVersion) {
  return lastAppVersion !== app.getVersion();
}

function clearAppCache() {
  if (mainWindow) {
    console.log('Clear cache after update');
    mainWindow.webContents.session.clearCache(() => {
      //Restart after cache clear
      mainWindow.reload();
    });
  } else {
    //Wait for mainWindow
    setTimeout(clearAppCache, 100);
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function getValidWindowPosition(state, screen) {
  // Check if the previous position is out of the viewable area
  // (e.g. because the screen has been plugged off)
  const displays = screen.getAllDisplays();
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (let i = 0; i < displays.length; i++) {
    const display = displays[i];
    maxX = Math.max(maxX, display.bounds.x + display.bounds.width);
    maxY = Math.max(maxY, display.bounds.y + display.bounds.height);
    minX = Math.min(minX, display.bounds.x);
    minY = Math.min(minY, display.bounds.y);
  }

  if (state.x > maxX || state.y > maxY || state.x < minX || state.y < minY) {
    Reflect.deleteProperty(state, 'x');
    Reflect.deleteProperty(state, 'y');
    Reflect.deleteProperty(state, 'width');
    Reflect.deleteProperty(state, 'height');
  }

  return state;
}

function handleScreenResize(screen, browserWindow) {
  function handle() {
    const position = browserWindow.getPosition();
    const size = browserWindow.getSize();
    const validPosition = getValidWindowPosition({
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    }, screen);
    browserWindow.setPosition(validPosition.x || 0, validPosition.y || 0);
  }

  browserWindow.on('restore', handle);
  handle();
}

app.on('browser-window-created', (e, newWindow) => {
  // Screen cannot be required before app is ready
  const {screen} = electron; // eslint-disable-line global-require
  handleScreenResize(screen, newWindow);
});

// For OSX, show hidden mainWindow when clicking dock icon.
app.on('activate', () => {
  mainWindow.show();
});

app.on('before-quit', () => {
  // Make sure tray icon gets removed if the user exits via CTRL-Q
  if (trayIcon && process.platform === 'win32') {
    trayIcon.destroy();
  }
  global.willAppQuit = true;
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (certificateStore.isTrusted(url, certificate)) {
    event.preventDefault();
    callback(true);
  } else {
    let detail = `URL: ${url}\nError: ${error}`;
    if (certificateStore.isExisting(url)) {
      detail = 'Certificate is different from previous one.\n\n' + detail;
    }

    dialog.showMessageBox(mainWindow, {
      title: 'Certificate error',
      message: `Do you trust certificate from "${certificate.issuerName}"?`,
      detail,
      type: 'warning',
      buttons: [
        'Yes',
        'No',
      ],
      cancelId: 1,
    }, (response) => {
      if (response === 0) {
        certificateStore.add(url, certificate);
        certificateStore.save();
        webContents.loadURL(url);
      }
    });
    callback(false);
  }
});

app.on('gpu-process-crashed', (event, killed) => {
  console.log(`The GPU process has crached (killed = ${killed})`);
});

const loginCallbackMap = new Map();

ipcMain.on('login-credentials', (event, request, user, password) => {
  const callback = loginCallbackMap.get(JSON.stringify(request));
  if (callback != null) {
    callback(user, password);
  }
});

app.on('login', (event, webContents, request, authInfo, callback) => {
  event.preventDefault();
  loginCallbackMap.set(JSON.stringify(request), callback);
  mainWindow.webContents.send('login-request', request, authInfo);
});

allowProtocolDialog.init(mainWindow);

ipcMain.on('download-url', (event, URL) => {
  downloadURL(mainWindow, URL, (err) => {
    if (err) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        message: err.toString(),
      });
      console.log(err);
    }
  });
});

if (isDev) {
  console.log('In development mode, deeplinking is disabled');
} else if (protocols && protocols[0] &&
  protocols[0].schemes && protocols[0].schemes[0]
) {
  scheme = protocols[0].schemes[0];
  app.setAsDefaultProtocolClient(scheme);
}

function setDeeplinkingUrl(url) {
  if (scheme) {
    deeplinkingUrl = url.replace(new RegExp('^' + scheme), 'https');
  }
}

app.on('will-finish-launching', () => {
  // Protocol handler for osx
  app.on('open-url', (event, url) => {
    event.preventDefault();
    setDeeplinkingUrl(url);
    if (app.isReady()) {
      function openDeepLink() {
        try {
          mainWindow.webContents.send('protocol-deeplink', deeplinkingUrl);
          mainWindow.show();
        } catch (err) {
          setTimeout(openDeepLink, 1000);
        }
      }
      openDeepLink();
    }
  });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', () => {
  if (global.willAppQuit) {
    return;
  }

  if (!config.spellCheckerLocale) {
    config.spellCheckerLocale = SpellChecker.getSpellCheckerLocale(app.getLocale());
    const configFile = app.getPath('userData') + '/config.json';
    settings.writeFileSync(configFile, config);
  }

  const appStateJson = path.join(app.getPath('userData'), 'app-state.json');
  appState = new AppStateManager(appStateJson);
  if (wasUpdated(appState.lastAppVersion)) {
    clearAppCache();
  }
  appState.lastAppVersion = app.getVersion();

  if (global.isDev) {
    installExtension(REACT_DEVELOPER_TOOLS).
      then((name) => console.log(`Added Extension:  ${name}`)).
      catch((err) => console.log('An error occurred: ', err));
  }

  // Protocol handler for win32
  if (process.platform === 'win32') {
    // Keep only command line / deep linked argument. Make sure it's not squirrel command
    const tmpArgs = process.argv.slice(1);
    if (
      Array.isArray(tmpArgs) && tmpArgs.length > 0 &&
      tmpArgs[0].match(/^--squirrel-/) === null
    ) {
      setDeeplinkingUrl(tmpArgs[0]);
    }
  }

  initCookieManager(session.defaultSession);

  mainWindow = createMainWindow(config, {
    hideOnStartup,
    linuxAppIcon: path.join(assetsDir, 'appicon.png'),
    deeplinkingUrl,
  });

  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
  criticalErrorHandler.setMainWindow(mainWindow);
  mainWindow.on('unresponsive', criticalErrorHandler.windowUnresponsiveHandler.bind(criticalErrorHandler));
  mainWindow.webContents.on('crashed', () => {
    throw new Error('webContents \'crashed\' event has been emitted');
  });

  ipcMain.on('notified', () => {
    if (process.platform === 'win32' || process.platform === 'linux') {
      if (config.notifications.flashWindow === 2) {
        mainWindow.flashFrame(true);
      }
    }

    if (process.platform === 'darwin' && config.notifications.bounceIcon) {
      app.dock.bounce(config.notifications.bounceIconType);
    }
  });

  ipcMain.on('update-title', (event, arg) => {
    mainWindow.setTitle(arg.title);
  });

  if (shouldShowTrayIcon()) {
    // set up tray icon
    trayIcon = new Tray(trayImages.normal);
    if (process.platform === 'darwin') {
      trayIcon.setPressedImage(trayImages.clicked.normal);
      systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
        switchMenuIconImages(trayImages, systemPreferences.isDarkMode());
        trayIcon.setImage(trayImages.normal);
      });
    }

    trayIcon.setToolTip(app.getName());
    trayIcon.on('click', () => {
      if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        } else {
          mainWindow.show();
        }
        mainWindow.focus();
        if (process.platform === 'darwin') {
          app.dock.show();
        }
      } else {
        mainWindow.focus();
      }
    });

    trayIcon.on('right-click', () => {
      trayIcon.popUpContextMenu();
    });
    trayIcon.on('balloon-click', () => {
      if (process.platform === 'win32' || process.platform === 'darwin') {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        } else {
          mainWindow.show();
        }
      }

      if (process.platform === 'darwin') {
        app.dock.show();
      }

      mainWindow.focus();
    });

    // Set overlay icon from dataURL
    // Set trayicon to show "dot"
    ipcMain.on('update-unread', (event, arg) => {
      if (process.platform === 'win32') {
        const overlay = arg.overlayDataURL ? nativeImage.createFromDataURL(arg.overlayDataURL) : null;
        if (mainWindow) {
          mainWindow.setOverlayIcon(overlay, arg.description);
        }
      }

      if (trayIcon && !trayIcon.isDestroyed()) {
        if (arg.sessionExpired) {
          // reuse the mention icon when the session is expired
          trayIcon.setImage(trayImages.mention);
          if (process.platform === 'darwin') {
            trayIcon.setPressedImage(trayImages.clicked.mention);
          }
          trayIcon.setToolTip('Session Expired: Please sign in to continue receiving notifications.');
        } else if (arg.mentionCount > 0) {
          trayIcon.setImage(trayImages.mention);
          if (process.platform === 'darwin') {
            trayIcon.setPressedImage(trayImages.clicked.mention);
          }
          trayIcon.setToolTip(arg.mentionCount + ' unread mentions');
        } else if (arg.unreadCount > 0) {
          trayIcon.setImage(trayImages.unread);
          if (process.platform === 'darwin') {
            trayIcon.setPressedImage(trayImages.clicked.unread);
          }
          trayIcon.setToolTip(arg.unreadCount + ' unread channels');
        } else {
          trayIcon.setImage(trayImages.normal);
          if (process.platform === 'darwin') {
            trayIcon.setPressedImage(trayImages.clicked.normal);
          }
          trayIcon.setToolTip(app.getName());
        }
      }
    });
  }

  if (process.platform === 'darwin') {
    session.defaultSession.on('will-download', (event, item) => {
      const filename = item.getFilename();
      const savePath = dialog.showSaveDialog({
        title: filename,
        defaultPath: os.homedir() + '/Downloads/' + filename,
      });

      if (savePath) {
        item.setSavePath(savePath);
      } else {
        item.cancel();
      }
    });
  }

  // Set application menu
  ipcMain.on('update-menu', (event, configData) => {
    const aMenu = appMenu.createMenu(mainWindow, configData, global.isDev);
    Menu.setApplicationMenu(aMenu);

    // set up context menu for tray icon
    if (shouldShowTrayIcon()) {
      const tMenu = trayMenu.createMenu(mainWindow, configData, global.isDev);
      if (process.platform === 'darwin' || process.platform === 'linux') {
        // store the information, if the tray was initialized, for checking in the settings, if the application
        // was restarted after setting "Show icon on menu bar"
        if (trayIcon) {
          trayIcon.setContextMenu(tMenu);
          mainWindow.trayWasVisible = true;
        } else {
          mainWindow.trayWasVisible = false;
        }
      } else {
        trayIcon.setContextMenu(tMenu);
      }
    }
  });
  ipcMain.emit('update-menu', true, config);

  ipcMain.on('update-dict', () => {
    if (config.useSpellChecker) {
      spellChecker = new SpellChecker(
        config.spellCheckerLocale,
        path.resolve(app.getAppPath(), 'node_modules/simple-spellchecker/dict'),
        (err) => {
          if (err) {
            console.error(err);
          }
        });
    }
  });
  ipcMain.on('checkspell', (event, word) => {
    let res = null;
    if (config.useSpellChecker && spellChecker.isReady() && word !== null) {
      res = spellChecker.spellCheck(word);
    }
    event.returnValue = res;
  });
  ipcMain.on('get-spelling-suggestions', (event, word) => {
    if (config.useSpellChecker && spellChecker.isReady() && word !== null) {
      event.returnValue = spellChecker.getSuggestions(word, 10);
    } else {
      event.returnValue = [];
    }
  });
  ipcMain.on('get-spellchecker-locale', (event) => {
    event.returnValue = config.spellCheckerLocale;
  });
  ipcMain.on('reply-on-spellchecker-is-ready', (event) => {
    if (!spellChecker) {
      return;
    }

    if (spellChecker.isReady()) {
      event.sender.send('spellchecker-is-ready');
      return;
    }
    spellChecker.once('ready', () => {
      event.sender.send('spellchecker-is-ready');
    });
  });
  ipcMain.emit('update-dict');

  const permissionFile = path.join(app.getPath('userData'), 'permission.json');
  const trustedURLs = settings.mergeDefaultTeams(config.teams).map((team) => team.url);
  permissionManager = new PermissionManager(permissionFile, trustedURLs);
  session.defaultSession.setPermissionRequestHandler(permissionRequestHandler(mainWindow, permissionManager));

  // Open the DevTools.
  // mainWindow.openDevTools();
});
