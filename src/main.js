// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import path from 'path';

import {URL} from 'url';

import electron from 'electron';
import isDev from 'electron-is-dev';
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';

import {protocols} from '../electron-builder.json';

import AutoLauncher from './main/AutoLauncher';
import CriticalErrorHandler from './main/CriticalErrorHandler';
import upgradeAutoLaunch from './main/autoLaunch';
import autoUpdater from './main/autoUpdater';
import RegistryConfig from './common/config/RegistryConfig';
import Config from './common/config';
import CertificateStore from './main/certificateStore';
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
import UserActivityMonitor from './main/UserActivityMonitor';
import Utils from './utils/util';
import parseArgs from './main/ParseArgs';

// pull out required electron components like this
// as not all components can be referenced before the app is ready
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
const criticalErrorHandler = new CriticalErrorHandler();
const assetsDir = path.resolve(app.getAppPath(), 'assets');
const loginCallbackMap = new Map();
const userActivityMonitor = new UserActivityMonitor();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let hideOnStartup = null;
let certificateStore = null;
let spellChecker = null;
let deeplinkingUrl = null;
let scheme = null;
let appState = null;
let permissionManager = null;
let registryConfig = null;
let config = null;
let trayIcon = null;
let trayImages = null;

/**
 * Main entry point for the application, ensures that everything initializes in the proper order
 */
async function initialize() {
  process.on('uncaughtException', criticalErrorHandler.processUncaughtExceptionHandler.bind(criticalErrorHandler));

  global.willAppQuit = false;

  // initialization that can run before the app is ready
  initializeArgs();
  initializeConfig();
  initializeAppEventListeners();
  initializeBeforeAppReady();

  // wait for registry config data to load and app ready event
  await Promise.all([
    registryConfig.init(),
    app.whenReady(),
  ]);

  // no need to continue initializing if app is quitting
  if (global.willAppQuit) {
    return;
  }

  // initialization that should run once the app is ready
  initializeInterCommunicationEventListeners();
  initializeAfterAppReady();
  initializeMainWindowListeners();
}

// attempt to initialize the application
try {
  initialize();
} catch (error) {
  throw new Error(`App initialization failed: ${error.toString()}`);
}

//
// initialization sub functions
//

function initializeArgs() {
  global.args = parseArgs(process.argv.slice(1));

  // output the application version via cli when requested (-v or --version)
  if (global.args.version) {
    process.stdout.write(`v.${app.getVersion()}\n`);
    process.exit(0); // eslint-disable-line no-process-exit
  }

  hideOnStartup = shouldBeHiddenOnStartup(global.args);

  global.isDev = isDev && !global.args.disableDevMode; // this doesn't seem to be right and isn't used as the single source of truth

  if (global.args['data-dir']) {
    app.setPath('userData', path.resolve(global.args['data-dir']));
  }
}

function initializeConfig() {
  registryConfig = new RegistryConfig();
  config = new Config(app.getPath('userData') + '/config.json');
  config.on('update', handleConfigUpdate);
  config.on('synchronize', handleConfigSynchronize);
}

function initializeAppEventListeners() {
  app.on('second-instance', handleAppSecondInstance);
  app.on('window-all-closed', handleAppWindowAllClosed);
  app.on('browser-window-created', handleAppBrowserWindowCreated);
  app.on('activate', handleAppActivate);
  app.on('before-quit', handleAppBeforeQuit);
  app.on('certificate-error', handleAppCertificateError);
  app.on('gpu-process-crashed', handleAppGPUProcessCrashed);
  app.on('login', handleAppLogin);
  app.on('will-finish-launching', handleAppWillFinishLaunching);
  app.on('web-contents-created', handleAppWebContentsCreated);
}

function initializeBeforeAppReady() {
  certificateStore = CertificateStore.load(path.resolve(app.getPath('userData'), 'certificate.json'));

  // can only call this before the app is ready
  if (config.enableHardwareAcceleration === false) {
    app.disableHardwareAcceleration();
  }

  trayImages = getTrayImages();

  // If there is already an instance, quit this one
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.exit();
    global.willAppQuit = true;
  }

  if (!config.spellCheckerLocale) {
    config.set('spellCheckerLocale', SpellChecker.getSpellCheckerLocale(app.getLocale()));
  }

  allowProtocolDialog.init(mainWindow);

  if (isDev) {
    console.log('In development mode, deeplinking is disabled');
  } else if (protocols && protocols[0] && protocols[0].schemes && protocols[0].schemes[0]) {
    scheme = protocols[0].schemes[0];
    app.setAsDefaultProtocolClient(scheme);
  }
}

function initializeInterCommunicationEventListeners() {
  ipcMain.on('reload-config', handleReloadConfig);
  ipcMain.on('login-credentials', handleLoginCredentialsEvent);
  ipcMain.on('download-url', handleDownloadURLEvent);
  ipcMain.on('notified', handleNotifiedEvent);
  ipcMain.on('update-title', handleUpdateTitleEvent);
  ipcMain.on('update-menu', handleUpdateMenuEvent);
  ipcMain.on('update-dict', handleUpdateDictionaryEvent);
  ipcMain.on('checkspell', handleCheckSpellingEvent);
  ipcMain.on('get-spelling-suggestions', handleGetSpellingSuggestionsEvent);
  ipcMain.on('get-spellchecker-locale', handleGetSpellcheckerLocaleEvent);
  ipcMain.on('reply-on-spellchecker-is-ready', handleReplyOnSpellcheckerIsReadyEvent);
  if (shouldShowTrayIcon()) {
    ipcMain.on('update-unread', handleUpdateUnreadEvent);
  }
  if (!isDev && config.enableAutoUpdater) {
    ipcMain.on('check-for-updates', autoUpdater.checkForUpdates);
  }
}

function initializeMainWindowListeners() {
  mainWindow.on('closed', handleMainWindowClosed);
  mainWindow.on('unresponsive', criticalErrorHandler.windowUnresponsiveHandler.bind(criticalErrorHandler));
  mainWindow.webContents.on('crashed', handleMainWindowWebContentsCrashed);
  mainWindow.on('ready-to-show', handleMainWindowReadyToShow);
  if (!isDev && config.enableAutoUpdater) {
    mainWindow.once('show', handleMainWindowShow);
  }
}

//
// config event handlers
//

function handleConfigUpdate(configData) {
  if (process.platform === 'win32' || process.platform === 'linux') {
    const appLauncher = new AutoLauncher();
    const autoStartTask = config.autostart ? appLauncher.enable() : appLauncher.disable();
    autoStartTask.then(() => {
      console.log('config.autostart has been configured:', config.autostart);
    }).catch((err) => {
      console.log('error:', err);
    });
  }

  if (permissionManager) {
    const trustedURLs = config.teams.map((team) => team.url);
    permissionManager.setTrustedURLs(trustedURLs);
    ipcMain.emit('update-dict', true, config.spellCheckerLocale);
  }

  ipcMain.emit('update-menu', true, configData);
}

function handleConfigSynchronize() {
  if (mainWindow) {
    mainWindow.webContents.send('reload-config');
  }
}

function handleReloadConfig() {
  config.reload();
}

//
// app event handlers
//

// activate first app instance, subsequent instances will quit themselves
function handleAppSecondInstance(event, argv) {
  // Protocol handler for win32
  // argv: An array of the second instance’s (command line / deep linked) arguments
  if (process.platform === 'win32') {
    deeplinkingUrl = getDeeplinkingURL(argv);
    if (deeplinkingUrl) {
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
}

function handleAppWindowAllClosed() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

function handleAppBrowserWindowCreated(error, newWindow) {
  // Screen cannot be required before app is ready
  const {screen} = electron;
  resizeScreen(screen, newWindow);
}

function handleAppActivate() {
  mainWindow.show();
}

function handleAppBeforeQuit() {
  // Make sure tray icon gets removed if the user exits via CTRL-Q
  if (trayIcon && process.platform === 'win32') {
    trayIcon.destroy();
  }
  global.willAppQuit = true;
}

function handleAppCertificateError(event, webContents, url, error, certificate, callback) {
  if (certificateStore.isTrusted(url, certificate)) {
    event.preventDefault();
    callback(true);
  } else {
    let detail = `URL: ${url}\nError: ${error}`;
    if (certificateStore.isExisting(url)) {
      detail = 'Certificate is different from previous one.\n\n' + detail;
    }
    dialog.showMessageBox(mainWindow, {
      title: 'Certificate Error',
      message: 'There is a configuration issue with this Mattermost server, or someone is trying to intercept your connection. You also may need to sign into the Wi-Fi you are connected to using your web browser.',
      type: 'error',
      buttons: [
        'More Details',
        'Cancel Connection',
      ],
      cancelId: 1,
    }, (response) => {
      if (response === 0) {
        dialog.showMessageBox(mainWindow, {
          title: 'Certificate Error',
          message: `Certificate from "${certificate.issuerName}" is not trusted.`,
          detail,
          type: 'error',
          buttons: [
            'Trust Insecure Certificate',
            'Cancel Connection',
          ],
          cancelId: 1,
        }, (responseTwo) => { //eslint-disable-line max-nested-callbacks
          if (responseTwo === 0) {
            certificateStore.add(url, certificate);
            certificateStore.save();
            webContents.loadURL(url);
          }
        });
      }
    });
    callback(false);
  }
}

function handleAppGPUProcessCrashed(event, killed) {
  console.log(`The GPU process has crashed (killed = ${killed})`);
}

function handleAppLogin(event, webContents, request, authInfo, callback) {
  event.preventDefault();
  loginCallbackMap.set(JSON.stringify(request), callback);
  mainWindow.webContents.send('login-request', request, authInfo);
}

function handleAppWillFinishLaunching() {
  // Protocol handler for osx
  app.on('open-url', (event, url) => {
    event.preventDefault();
    deeplinkingUrl = getDeeplinkingURL([url]);
    if (app.isReady()) {
      function openDeepLink() {
        try {
          if (deeplinkingUrl) {
            mainWindow.webContents.send('protocol-deeplink', deeplinkingUrl);
            mainWindow.show();
          }
        } catch (err) {
          setTimeout(openDeepLink, 1000);
        }
      }
      openDeepLink();
    }
  });
}

function handleAppWebContentsCreated(dc, contents) {
  contents.on('will-attach-webview', (event, webPreferences) => {
    webPreferences.nodeIntegration = false;
  });
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const trustedURLs = config.teams.map((team) => new URL(team.url)); //eslint-disable-line max-nested-callbacks

    let trusted = false;
    for (const url of trustedURLs) {
      if (parsedUrl.origin === url.origin) {
        trusted = true;
        break;
      }
    }

    if (!trusted) {
      event.preventDefault();
    }
  });
  contents.on('new-window', (event) => {
    event.preventDefault();
  });
}

function initializeAfterAppReady() {
  app.setAppUserModelId('Mattermost.Desktop'); // Use explicit AppUserModelID

  const appStateJson = path.join(app.getPath('userData'), 'app-state.json');
  appState = new AppStateManager(appStateJson);
  if (wasUpdated(appState.lastAppVersion)) {
    clearAppCache();
  }
  appState.lastAppVersion = app.getVersion();

  if (!global.isDev) {
    upgradeAutoLaunch();
  }

  if (global.isDev) {
    installExtension(REACT_DEVELOPER_TOOLS).
      then((name) => console.log(`Added Extension:  ${name}`)).
      catch((err) => console.log('An error occurred: ', err));
  }

  // Protocol handler for win32
  if (process.platform === 'win32') {
    const args = process.argv.slice(1);
    if (Array.isArray(args) && args.length > 0) {
      deeplinkingUrl = getDeeplinkingURL(args);
    }
  }

  initCookieManager(session.defaultSession);

  mainWindow = createMainWindow(config.data, {
    hideOnStartup,
    linuxAppIcon: path.join(assetsDir, 'appicon.png'),
    deeplinkingUrl,
  });

  criticalErrorHandler.setMainWindow(mainWindow);

  config.setRegistryConfigData(registryConfig.data);
  mainWindow.registryConfigData = registryConfig.data;

  // listen for status updates and pass on to renderer
  userActivityMonitor.on('status', (status) => {
    mainWindow.webContents.send('user-activity-update', status);
  });

  // start monitoring user activity (needs to be started after the app is ready)
  userActivityMonitor.startMonitoring();

  if (shouldShowTrayIcon) {
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

  ipcMain.emit('update-menu', true, config.data);

  ipcMain.emit('update-dict');

  const permissionFile = path.join(app.getPath('userData'), 'permission.json');
  const trustedURLs = config.teams.map((team) => team.url);
  permissionManager = new PermissionManager(permissionFile, trustedURLs);
  session.defaultSession.setPermissionRequestHandler(permissionRequestHandler(mainWindow, permissionManager));

  if (!isDev && config.enableAutoUpdater) {
    const updaterConfig = autoUpdater.loadConfig();
    autoUpdater.initialize(appState, mainWindow, updaterConfig.isNotifyOnly());
    ipcMain.on('check-for-updates', autoUpdater.checkForUpdates);
    mainWindow.once('show', () => {
      if (autoUpdater.shouldCheckForUpdatesOnStart(appState.updateCheckedDate)) {
        ipcMain.emit('check-for-updates');
      } else {
        setTimeout(() => {
          ipcMain.emit('check-for-updates');
        }, autoUpdater.UPDATER_INTERVAL_IN_MS);
      }
    });
  }
}

//
// ipc communication event handlers
//

function handleLoginCredentialsEvent(event, request, user, password) {
  const callback = loginCallbackMap.get(JSON.stringify(request));
  if (callback != null) {
    callback(user, password);
  }
}

function handleDownloadURLEvent(event, url) {
  downloadURL(mainWindow, url, (err) => {
    if (err) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        message: err.toString(),
      });
      console.log(err);
    }
  });
}

function handleNotifiedEvent() {
  if (process.platform === 'win32' || process.platform === 'linux') {
    if (config.notifications.flashWindow === 2) {
      mainWindow.flashFrame(true);
    }
  }

  if (process.platform === 'darwin' && config.notifications.bounceIcon) {
    app.dock.bounce(config.notifications.bounceIconType);
  }
}

function handleUpdateTitleEvent(event, arg) {
  mainWindow.setTitle(arg.title);
}

function handleUpdateUnreadEvent(event, arg) {
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
}

function handleUpdateMenuEvent(event, configData) {
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
    } else if (trayIcon) {
      trayIcon.setContextMenu(tMenu);
    }
  }
}

function handleUpdateDictionaryEvent() {
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
}

function handleCheckSpellingEvent(event, word) {
  let res = null;
  if (config.useSpellChecker && spellChecker.isReady() && word !== null) {
    res = spellChecker.spellCheck(word);
  }
  event.returnValue = res;
}

function handleGetSpellingSuggestionsEvent(event, word) {
  if (config.useSpellChecker && spellChecker.isReady() && word !== null) {
    event.returnValue = spellChecker.getSuggestions(word, 10);
  } else {
    event.returnValue = [];
  }
}

function handleGetSpellcheckerLocaleEvent(event) {
  event.returnValue = config.spellCheckerLocale;
}

function handleReplyOnSpellcheckerIsReadyEvent(event) {
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
}

//
// mainWindow event handlers
//

function handleMainWindowClosed() {
  // Dereference the window object, usually you would store windows
  // in an array if your app supports multi windows, this is the time
  // when you should delete the corresponding element.
  mainWindow = null;
}

function handleMainWindowWebContentsCrashed() {
  throw new Error('webContents \'crashed\' event has been emitted');
}

function handleMainWindowReadyToShow() {
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
}

function handleMainWindowShow() {
  if (!isDev) {
    if (autoUpdater.shouldCheckForUpdatesOnStart(appState.updateCheckedDate)) {
      ipcMain.emit('check-for-updates');
    } else {
      setTimeout(() => {
        ipcMain.emit('check-for-updates');
      }, autoUpdater.UPDATER_INTERVAL_IN_MS);
    }
  }
}

//
// helper functions
//

function getTrayImages() {
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
}

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

function getDeeplinkingURL(args) {
  if (Array.isArray(args) && args.length) {
    // deeplink urls should always be the last argument, but may not be the first (i.e. Windows with the app already running)
    const url = args[args.length - 1];
    if (url && scheme && url.startsWith(scheme) && Utils.isValidURI(url)) {
      return url;
    }
  }
  return null;
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

function resizeScreen(screen, browserWindow) {
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
