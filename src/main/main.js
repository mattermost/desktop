// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai
import fs from 'fs';

import path from 'path';

import electron, {nativeTheme, shell} from 'electron';
import isDev from 'electron-is-dev';
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';
import log from 'electron-log';
import 'airbnb-js-shims/target/es2015';

import Utils from 'common/utils/util';
import urlUtils from 'common/utils/url';

import {DEVELOPMENT, PRODUCTION, SECOND} from 'common/utils/constants';
import {SWITCH_SERVER, FOCUS_BROWSERVIEW, QUIT, DARK_MODE_CHANGE, DOUBLE_CLICK_ON_WINDOW, SHOW_NEW_SERVER_MODAL, WINDOW_CLOSE, WINDOW_MAXIMIZE, WINDOW_MINIMIZE, WINDOW_RESTORE, NOTIFY_MENTION, GET_DOWNLOAD_LOCATION} from 'common/communication';
import {REQUEST_PERMISSION_CHANNEL, GRANT_PERMISSION_CHANNEL, DENY_PERMISSION_CHANNEL, BASIC_AUTH_PERMISSION} from 'common/permissions';
import Config from 'common/config';

import {protocols} from '../../electron-builder.json';

import AutoLauncher from './AutoLauncher';
import CriticalErrorHandler from './CriticalErrorHandler';
import upgradeAutoLaunch from './autoLaunch';
import CertificateStore from './certificateStore';
import TrustedOriginsStore from './trustedOrigins';
import appMenu from './menus/app';
import trayMenu from './menus/tray';
import downloadURL from './downloadURL';
import allowProtocolDialog from './allowProtocolDialog';
import AppStateManager from './AppStateManager';
import initCookieManager from './cookieManager';
import UserActivityMonitor from './UserActivityMonitor';
import * as WindowManager from './windows/windowManager';
import {showBadge} from './badge';
import {displayMention, displayDownloadCompleted} from './notifications';

import parseArgs from './ParseArgs';
import {addModal} from './modalManager';
import {getLocalURLString} from './utils';
import {getTrayImages, switchMenuIconImages} from './tray/tray';

if (process.env.NODE_ENV !== 'production' && module.hot) {
  module.hot.accept();
}

// pull out required electron components like this
// as not all components can be referenced before the app is ready
const {
  app,
  Menu,
  Tray,
  ipcMain,
  dialog,
  systemPreferences,
  session,
  BrowserWindow,
} = electron;
const criticalErrorHandler = new CriticalErrorHandler();
const loginCallbackMap = new Map();
const certificateRequests = new Map();
const userActivityMonitor = new UserActivityMonitor();
const certificateErrorCallbacks = new Map();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let popupWindow = null;
let certificateStore = null;
let trustedOriginsStore = null;
let deeplinkingUrl = null;
let scheme = null;
let appState = null;
let config = null;
let trayIcon = null;
let trayImages = null;

// supported custom login paths (oath, saml)
const customLoginRegexPaths = [
  /^\/oauth\/authorize$/i,
  /^\/oauth\/deauthorize$/i,
  /^\/oauth\/access_token$/i,
  /^\/oauth\/[A-Za-z0-9]+\/complete$/i,
  /^\/oauth\/[A-Za-z0-9]+\/login$/i,
  /^\/oauth\/[A-Za-z0-9]+\/signup$/i,
  /^\/api\/v3\/oauth\/[A-Za-z0-9]+\/complete$/i,
  /^\/signup\/[A-Za-z0-9]+\/complete$/i,
  /^\/login\/[A-Za-z0-9]+\/complete$/i,
  /^\/login\/sso\/saml$/i,
];

// tracking in progress custom logins
const customLogins = {};

const nixUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36';

const popupUserAgent = {
  darwin: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
  win32: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
  aix: nixUA,
  freebsd: nixUA,
  linux: nixUA,
  openbsd: nixUA,
  sunos: nixUA,
};

/**
 * Main entry point for the application, ensures that everything initializes in the proper order
 */
async function initialize() {
  process.on('uncaughtException', criticalErrorHandler.processUncaughtExceptionHandler.bind(criticalErrorHandler));
  global.willAppQuit = false;

  // initialization that can run before the app is ready
  initializeArgs();
  await initializeConfig();
  initializeAppEventListeners();
  initializeBeforeAppReady();

  // wait for registry config data to load and app ready event
  await Promise.all([
    app.whenReady(),
  ]);

  // no need to continue initializing if app is quitting
  if (global.willAppQuit) {
    return;
  }

  // initialization that should run once the app is ready
  initializeInterCommunicationEventListeners();
  initializeAfterAppReady();
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

  global.isDev = isDev && !global.args.disableDevMode; // this doesn't seem to be right and isn't used as the single source of truth

  if (global.args.dataDir) {
    app.setPath('userData', path.resolve(global.args.dataDir));
  }
}

async function initializeConfig() {
  const loadConfig = new Promise((resolve) => {
    config = new Config(app.getPath('userData') + '/config.json');
    config.once('update', (configData) => {
      config.on('update', handleConfigUpdate);
      config.on('synchronize', handleConfigSynchronize);
      config.on('darkModeChange', handleDarkModeChange);
      handleConfigUpdate(configData);
      resolve();
    });
    config.init();
  });

  return loadConfig;
}

function initializeAppEventListeners() {
  app.on('second-instance', handleAppSecondInstance);
  app.on('window-all-closed', handleAppWindowAllClosed);
  app.on('browser-window-created', handleAppBrowserWindowCreated);
  app.on('activate', handleAppActivate);
  app.on('before-quit', handleAppBeforeQuit);
  app.on('certificate-error', handleAppCertificateError);
  app.on('select-client-certificate', handleSelectCertificate);
  app.on('gpu-process-crashed', handleAppGPUProcessCrashed);
  app.on('login', handleAppLogin);
  app.on('will-finish-launching', handleAppWillFinishLaunching);
  app.on('web-contents-created', handleAppWebContentsCreated);
}

function initializeBeforeAppReady() {
  certificateStore = CertificateStore.load(path.resolve(app.getPath('userData'), 'certificate.json'));
  trustedOriginsStore = new TrustedOriginsStore(path.resolve(app.getPath('userData'), 'trustedOrigins.json'));
  trustedOriginsStore.load();

  // prevent using a different working directory, which happens on windows running after installation.
  const expectedPath = path.dirname(process.execPath);
  if (process.cwd() !== expectedPath && !isDev) {
    log.warn(`Current working directory is ${process.cwd()}, changing into ${expectedPath}`);
    process.chdir(expectedPath);
  }

  // can only call this before the app is ready
  if (config.enableHardwareAcceleration === false) {
    app.disableHardwareAcceleration();
  }

  trayImages = getTrayImages(config.trayIconTheme);

  // If there is already an instance, quit this one
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.exit();
    global.willAppQuit = true;
  }

  allowProtocolDialog.init();

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
  ipcMain.on('login-cancel', handleCancelLoginEvent);
  ipcMain.on('download-url', handleDownloadURLEvent);
  ipcMain.on(NOTIFY_MENTION, handleMentionNotification);
  ipcMain.handle('get-app-version', handleAppVersion);

  // see comment on function
  // ipcMain.on('update-title', handleUpdateTitleEvent);
  ipcMain.on('update-menu', handleUpdateMenuEvent);
  ipcMain.on('selected-client-certificate', handleSelectedCertificate);
  ipcMain.on(GRANT_PERMISSION_CHANNEL, handlePermissionGranted);
  ipcMain.on(DENY_PERMISSION_CHANNEL, handlePermissionDenied);
  ipcMain.on(FOCUS_BROWSERVIEW, WindowManager.focusBrowserView);

  if (shouldShowTrayIcon()) {
    ipcMain.on('update-unread', handleUpdateUnreadEvent);
  }
  if (process.platform !== 'darwin') {
    ipcMain.on('open-app-menu', handleOpenAppMenu);
  }

  ipcMain.on(SWITCH_SERVER, handleSwitchServer);

  ipcMain.on(QUIT, handleQuit);

  ipcMain.on(DOUBLE_CLICK_ON_WINDOW, WindowManager.handleDoubleClick);

  ipcMain.on(SHOW_NEW_SERVER_MODAL, handleNewServerModal);
  ipcMain.on(WINDOW_CLOSE, WindowManager.close);
  ipcMain.on(WINDOW_MAXIMIZE, WindowManager.maximize);
  ipcMain.on(WINDOW_MINIMIZE, WindowManager.minimize);
  ipcMain.on(WINDOW_RESTORE, WindowManager.restore);
  ipcMain.handle(GET_DOWNLOAD_LOCATION, handleSelectDownload);
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
    if (app.isReady()) {
      WindowManager.setConfig(config.data, config.showTrayIcon, deeplinkingUrl);
    }
  }

  ipcMain.emit('update-menu', true, configData);
}

function handleConfigSynchronize() {
  // TODO: send this to server manager
  WindowManager.setConfig(config.data, config.showTrayIcon, deeplinkingUrl);
  if (app.isReady()) {
    WindowManager.sendToRenderer('reload-config');
  }
}

function handleReloadConfig() {
  config.reload();
  WindowManager.setConfig(config.data, config.showTrayIcon, deeplinkingUrl);
}

function handleAppVersion() {
  return {
    name: app.getName(),
    version: app.getVersion(),
  };
}

function handleDarkModeChange(darkMode) {
  trayImages = getTrayImages(config.trayIconTheme);
  WindowManager.sendToRenderer(DARK_MODE_CHANGE, darkMode);
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

    // TODO: handle deeplinking into the tab manager as we have to send them to the appropiate BV
    if (deeplinkingUrl) {
      WindowManager.sendToRenderer('protocol-deeplink', deeplinkingUrl);
    }
  }

  // Someone tried to run a second instance, we should focus our window.
  WindowManager.restoreMain();
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
  resizeScreen(electron.screen, newWindow);
}

function handleAppActivate() {
  WindowManager.showMainWindow();
}

function handleAppBeforeQuit() {
  // Make sure tray icon gets removed if the user exits via CTRL-Q
  if (trayIcon && process.platform === 'win32') {
    trayIcon.destroy();
  }
  global.willAppQuit = true;
}

function handleQuit(e, reason, stack) {
  log.error(`Exiting App. Reason: ${reason}`);
  log.info(`Stacktrace:\n${stack}`);
  handleAppBeforeQuit();
  app.quit();
}

function handleSelectCertificate(event, webContents, url, list, callback) {
  if (list.length > 1) {
    event.preventDefault(); // prevent the app from getting the first certificate available
    // store callback so it can be called with selected certificate
    certificateRequests.set(url, callback);

    // open modal for selecting certificate
    WindowManager.getMainWindow(true).webContents.send('select-user-certificate', url, list);
  } else {
    log.info(`There were ${list.length} candidate certificates. Skipping certificate selection`);
  }
}

function handleSelectedCertificate(event, server, cert) {
  const callback = certificateRequests.get(server);
  if (!callback) {
    log.error(`there was no callback associated with: ${server}`);
    return;
  }
  if (typeof cert === 'undefined') {
    log.info('user canceled certificate selection');
  } else {
    try {
      callback(cert);
    } catch (e) {
      log.error(`There was a problem using the selected certificate: ${e}`);
    }
  }
}

function handleAppCertificateError(event, webContents, url, error, certificate, callback) {
  const parsedURL = new URL(url);
  if (!parsedURL) {
    return;
  }
  const origin = parsedURL.origin;
  if (certificateStore.isTrusted(origin, certificate)) {
    event.preventDefault();
    callback(true);
  } else {
    // update the callback
    const errorID = `${origin}:${error}`;

    // if we are already showing that error, don't add more dialogs
    if (certificateErrorCallbacks.has(errorID)) {
      log.warn(`Ignoring already shown dialog for ${errorID}`);
      certificateErrorCallbacks.set(errorID, callback);
      return;
    }
    const extraDetail = certificateStore.isExisting(origin) ? 'Certificate is different from previous one.\n\n' : '';
    const detail = `${extraDetail}origin: ${origin}\nError: ${error}`;

    certificateErrorCallbacks.set(errorID, callback);

    // TODO: should we move this to window manager or provide a handler for dialogs?
    const mainWindow = WindowManager.getMainWindow();
    dialog.showMessageBox(mainWindow, {
      title: 'Certificate Error',
      message: 'There is a configuration issue with this Mattermost server, or someone is trying to intercept your connection. You also may need to sign into the Wi-Fi you are connected to using your web browser.',
      type: 'error',
      detail,
      buttons: ['More Details', 'Cancel Connection'],
      cancelId: 1,
    }).then(
      ({response}) => {
        if (response === 0) {
          return dialog.showMessageBox(mainWindow, {
            title: 'Certificate Not Trusted',
            message: `Certificate from "${certificate.issuerName}" is not trusted.`,
            detail: extraDetail,
            type: 'error',
            buttons: ['Trust Insecure Certificate', 'Cancel Connection'],
            cancelId: 1,
          });
        }
        return {response};
      }).then(
      ({response: responseTwo}) => {
        if (responseTwo === 0) {
          certificateStore.add(origin, certificate);
          certificateStore.save();
          certificateErrorCallbacks.get(errorID)(true);
          certificateErrorCallbacks.delete(errorID);
          webContents.loadURL(url);
        } else {
          certificateErrorCallbacks.get(errorID)(false);
          certificateErrorCallbacks.delete(errorID);
        }
      }).catch(
      (dialogError) => {
        log.error(`There was an error with the Certificate Error dialog: ${dialogError}`);
        certificateErrorCallbacks.delete(errorID);
      });
  }
}

function handleAppGPUProcessCrashed(event, killed) {
  console.log(`The GPU process has crashed (killed = ${killed})`);
}

function handleAppLogin(event, webContents, request, authInfo, callback) {
  event.preventDefault();
  const parsedURL = new URL(request.url);
  const server = urlUtils.getServer(parsedURL, config.teams);

  loginCallbackMap.set(request.url, typeof callback === 'undefined' ? null : callback); // if callback is undefined set it to null instead so we know we have set it up with no value
  const mainWindow = WindowManager.getMainWindow(true);
  if (isTrustedURL(request.url) || isCustomLoginURL(parsedURL, server) || trustedOriginsStore.checkPermission(request.url, BASIC_AUTH_PERMISSION)) {
    mainWindow.webContents.send('login-request', request, authInfo);
  } else {
    mainWindow.webContents.send(REQUEST_PERMISSION_CHANNEL, request, authInfo, BASIC_AUTH_PERMISSION);
  }
}

function handlePermissionGranted(event, url, permission) {
  trustedOriginsStore.addPermission(url, permission);
  trustedOriginsStore.save();
}

function handlePermissionDenied(event, url, permission, reason) {
  log.warn(`Permission request denied: ${reason}`);
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
            // TODO: send this to tab manager.
            //mainWindow.webContents.send('protocol-deeplink', deeplinkingUrl);
            WindowManager.showMainWindow();
          }
        } catch (err) {
          setTimeout(openDeepLink, SECOND);
        }
      }
      openDeepLink();
    }
  });
}

function handleSwitchServer(event, serverName) {
  WindowManager.switchServer(serverName);
}

function handleNewServerModal() {
  const html = getLocalURLString('newServer.html');

  //  const modalPreload = getLocalURLString('modalPreload.js');
  const modalPreload = path.resolve(__dirname, '../../dist/modalPreload.js');

  // eslint-disable-next-line no-undefined
  const modalPromise = addModal('newServer', html, modalPreload, {}, WindowManager.getMainWindow());
  if (modalPromise) {
    modalPromise.then((data) => {
      const teams = config.teams;
      const order = teams.length;
      teams.push({...data, order});
      config.set('teams', teams);
    }).catch((e) => {
      // e is undefined for user cancellation
      if (e) {
        console.error(`there was an error in the new server modal: ${e}`);
      }
    });
  } else {
    console.warn('There is already a new server modal');
  }
}

function handleAppWebContentsCreated(dc, contents) {
  // initialize custom login tracking
  customLogins[contents.id] = {
    inProgress: false,
  };

  contents.on('will-navigate', (event, url) => {
    const contentID = event.sender.id;
    const parsedURL = urlUtils.parseURL(url);
    const server = urlUtils.getServer(parsedURL, config.teams);

    if (server && (urlUtils.isTeamUrl(server.url, parsedURL) || urlUtils.isAdminUrl(server.url, parsedURL) || isTrustedPopupWindow(event.sender))) {
      return;
    }

    if (isCustomLoginURL(parsedURL, server)) {
      return;
    }
    if (parsedURL.protocol === 'mailto:') {
      return;
    }
    if (customLogins[contentID].inProgress) {
      return;
    }
    const mode = Utils.runMode();
    if (((mode === DEVELOPMENT || mode === PRODUCTION) &&
          (parsedURL.path === 'renderer/index.html' || parsedURL.path === 'renderer/settings.html'))) {
      log.info('loading settings page');
      return;
    }

    log.info(`Prevented desktop from navigating to: ${url}`);
    event.preventDefault();
  });

  // handle custom login requests (oath, saml):
  // 1. are we navigating to a supported local custom login path from the `/login` page?
  //    - indicate custom login is in progress
  // 2. are we finished with the custom login process?
  //    - indicate custom login is NOT in progress
  contents.on('did-start-navigation', (event, url) => {
    const contentID = event.sender.id;
    const parsedURL = urlUtils.parseURL(url);
    const server = urlUtils.getServer(parsedURL, config.teams);

    if (!isTrustedURL(parsedURL)) {
      return;
    }

    if (isCustomLoginURL(parsedURL, server)) {
      customLogins[contentID].inProgress = true;
    } else if (customLogins[contentID].inProgress) {
      customLogins[contentID].inProgress = false;
    }
  });

  contents.on('new-window', (event, url) => {
    const parsedURL = urlUtils.parseURL(url);

    if (parsedURL.protocol === 'devtools:') {
      return;
    }
    event.preventDefault();

    const server = urlUtils.getServer(parsedURL, config.teams);

    if (!server) {
      shell.openExternal(url);
      return;
    }
    if (urlUtils.isTeamUrl(server.url, parsedURL, true)) {
      log.info(`${url} is a known team, preventing to open a new window`);
      return;
    }
    if (Utils.isAdminUrl(server.url, parsedURL)) {
      log.info(`${url} is an admin console page, preventing to open a new window`);
      return;
    }
    if (popupWindow && !popupWindow.closed && popupWindow.getURL() === url) {
      log.info(`Popup window already open at provided url: ${url}`);
      return;
    }

    // TODO: move popups to its own and have more than one.
    if (urlUtils.isPluginUrl(server.url, parsedURL) || urlUtils.isManagedResource(server.url, parsedURL)) {
      if (!popupWindow || popupWindow.closed) {
        popupWindow = new BrowserWindow({
          backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
          parent: WindowManager.getMainWindow(),
          show: false,
          center: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            spellcheck: (typeof config.useSpellChecker === 'undefined' ? true : config.useSpellChecker),
          },
        });
        popupWindow.once('ready-to-show', () => {
          popupWindow.show();
        });
        popupWindow.once('closed', () => {
          popupWindow = null;
        });
      }

      if (urlUtils.isManagedResource(server.url, parsedURL)) {
        popupWindow.loadURL(url);
      } else {
        // currently changing the userAgent for popup windows to allow plugins to go through google's oAuth
        // should be removed once a proper oAuth2 implementation is setup.
        popupWindow.loadURL(url, {
          userAgent: popupUserAgent[process.platform],
        });
      }
    }
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

  // Workaround for MM-22193
  // From this post: https://github.com/electron/electron/issues/19468#issuecomment-549593139
  // Electron 6 has a bug that affects users on Windows 10 using dark mode, causing the app to hang
  // This workaround deletes a file that stops that from happening
  if (process.platform === 'win32') {
    const appUserDataPath = app.getPath('userData');
    const devToolsExtensionsPath = path.join(appUserDataPath, 'DevTools Extensions');
    try {
      fs.unlinkSync(devToolsExtensionsPath);
    } catch (_) {
      // don't complain if the file doesn't exist
    }
  }

  // Protocol handler for win32
  if (process.platform === 'win32') {
    const args = process.argv.slice(1);
    if (Array.isArray(args) && args.length > 0) {
      deeplinkingUrl = getDeeplinkingURL(args);
    }
  }

  initCookieManager(session.defaultSession);

  WindowManager.showMainWindow();

  // TODO: remove dev tools
  if (config.teams.length === 0) {
    WindowManager.showSettingsWindow();
  }

  criticalErrorHandler.setMainWindow(WindowManager.getMainWindow());

  // TODO: this has to be sent to the tabs instead
  // listen for status updates and pass on to renderer
  userActivityMonitor.on('status', (status) => {
    WindowManager.sendToRenderer('user-activity-update', status);
  });

  // start monitoring user activity (needs to be started after the app is ready)
  userActivityMonitor.startMonitoring();

  if (shouldShowTrayIcon()) {
    // set up tray icon
    trayIcon = new Tray(trayImages.normal);
    if (process.platform === 'darwin') {
      trayIcon.setPressedImage(trayImages.clicked.normal);
      systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
        switchMenuIconImages(trayImages, nativeTheme.shouldUseDarkColors);
        trayIcon.setImage(trayImages.normal);
      });
    }

    trayIcon.setToolTip(app.name);
    trayIcon.on('click', () => {
      WindowManager.restoreMain();
    });

    trayIcon.on('right-click', () => {
      trayIcon.popUpContextMenu();
    });
    trayIcon.on('balloon-click', () => {
      WindowManager.restoreMain();
    });
  }

  session.defaultSession.on('will-download', (event, item, webContents) => {
    const filename = item.getFilename();
    const fileElements = filename.split('.');
    const filters = [];
    if (fileElements.length > 1) {
      filters.push({
        name: `${fileElements[fileElements.length - 1]} files`,
        extensions: [fileElements[fileElements.length - 1]],
      });
    }

    // add default filter
    filters.push({
      name: 'All files',
      extensions: ['*'],
    });
    item.setSaveDialogOptions({
      title: filename,
      defaultPath: path.resolve(config.combinedData.downloadLocation, filename),
      filters,
    });

    item.on('done', (doneEvent, state) => {
      if (state === 'completed') {
        displayDownloadCompleted(filename, item.savePath, urlUtils.getServer(webContents.getURL(), config.teams));
      }
    });
  });

  ipcMain.emit('update-menu', true, config.data);

  ipcMain.emit('update-dict');

  // supported permission types
  const supportedPermissionTypes = [
    'media',
    'geolocation',
    'notifications',
    'fullscreen',
    'openExternal',
  ];

  // handle permission requests
  // - approve if a supported permission type and the request comes from the renderer or one of the defined servers
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // is the requested permission type supported?
    if (!supportedPermissionTypes.includes(permission)) {
      callback(false);
      return;
    }

    // is the request coming from the renderer?
    const mainWindow = WindowManager.getMainWindow();
    if (mainWindow && webContents.id === mainWindow.webContents.id) {
      callback(true);
      return;
    }

    const requestingURL = webContents.getURL();

    // is the requesting url trusted?
    callback(isTrustedURL(requestingURL));
  });
}

//
// ipc communication event handlers
//

function handleLoginCredentialsEvent(event, request, user, password) {
  const callback = loginCallbackMap.get(request.url);
  if (typeof callback === 'undefined') {
    log.error(`Failed to retrieve login callback for ${request.url}`);
    return;
  }
  if (callback != null) {
    callback(user, password);
  }
  loginCallbackMap.delete(request.url);
}

function handleCancelLoginEvent(event, request) {
  log.info(`Cancelling request for ${request ? request.url : 'unknown'}`);
  handleLoginCredentialsEvent(event, request); // we use undefined to cancel the request
}

function handleDownloadURLEvent(event, url) {
  downloadURL(url, (err) => {
    if (err) {
      dialog.showMessageBox(WindowManager.getMainWindow(), {
        type: 'error',
        message: err.toString(),
      });
      log.error(err);
    }
  });
}

function handleMentionNotification(event, title, body, channel, teamId, silent, data) {
  displayMention(title, body, channel, teamId, silent, event.sender, data);
}

// TODO: figure out if we want to inherit title from webpage or use one of our own
// function handleUpdateTitleEvent(event, arg) {
//   mainWindow.setTitle(arg.title);
// }

function handleUpdateUnreadEvent(event, arg) {
  showBadge(arg.sessionExpired, arg.unreadCount, arg.mentionCount, config.showUnreadBadge);

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
      trayIcon.setToolTip(app.name);
    }
  }
}

function handleOpenAppMenu() {
  Menu.getApplicationMenu().popup({
    x: 18,
    y: 18,
  });
}

function handleCloseAppMenu() {
  WindowManager.focusBrowserView();
}

function handleUpdateMenuEvent(event, configData) {
  // TODO: this might make sense to move to window manager? so it updates the window referenced if needed.
  const mainWindow = WindowManager.getMainWindow();
  const aMenu = appMenu.createMenu(configData);
  Menu.setApplicationMenu(aMenu);
  aMenu.addListener('menu-will-close', handleCloseAppMenu);

  // set up context menu for tray icon
  if (shouldShowTrayIcon()) {
    const tMenu = trayMenu.createMenu(configData);
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

async function handleSelectDownload(event, startFrom) {
  const message = 'Specify the folder where files will download';
  const result = await dialog.showOpenDialog({defaultPath: startFrom,
    message,
    properties:
     ['openDirectory', 'createDirectory', 'dontAddToRecent', 'promptToCreate']});
  return result.filePaths[0];
}

//
// helper functions
//

function isTrustedURL(url) {
  const parsedURL = urlUtils.parseURL(url);
  if (!parsedURL) {
    return false;
  }
  return urlUtils.getServer(parsedURL, config.teams) !== null;
}

function isTrustedPopupWindow(webContents) {
  if (!webContents) {
    return false;
  }
  if (!popupWindow) {
    return false;
  }
  return BrowserWindow.fromWebContents(webContents) === popupWindow;
}

function isCustomLoginURL(url, server) {
  const subpath = (server === null || typeof server === 'undefined') ? '' : server.url.pathname;
  const parsedURL = urlUtils.parseURL(url);
  if (!parsedURL) {
    return false;
  }
  if (!isTrustedURL(parsedURL)) {
    return false;
  }
  const urlPath = parsedURL.pathname;
  if ((subpath !== '' || subpath !== '/') && urlPath.startsWith(subpath)) {
    const replacement = subpath.endsWith('/') ? '/' : '';
    const replacedPath = urlPath.replace(subpath, replacement);
    for (const regexPath of customLoginRegexPaths) {
      if (replacedPath.match(regexPath)) {
        return true;
      }
    }
  }

  // if there is no subpath, or we are adding the team and got redirected to the real server it'll be caught here
  for (const regexPath of customLoginRegexPaths) {
    if (urlPath.match(regexPath)) {
      return true;
    }
  }
  return false;
}

function getDeeplinkingURL(args) {
  if (Array.isArray(args) && args.length) {
    // deeplink urls should always be the last argument, but may not be the first (i.e. Windows with the app already running)
    const url = args[args.length - 1];
    if (url && scheme && url.startsWith(scheme) && urlUtils.isValidURI(url)) {
      return url;
    }
  }
  return null;
}

function shouldShowTrayIcon() {
  return config.showTrayIcon || process.platform === 'win32';
}

function wasUpdated(lastAppVersion) {
  return lastAppVersion !== app.getVersion();
}

function clearAppCache() {
  // TODO: clear cache on browserviews, not in the renderer.
  const mainWindow = WindowManager.getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.session.clearCache().then(mainWindow.reload);
  } else {
    //Wait for mainWindow
    setTimeout(clearAppCache, 100);
  }
}

function isWithinDisplay(state, display) {
  const startsWithinDisplay = !(state.x > display.maxX || state.y > display.maxY || state.x < display.minX || state.y < display.minY);
  if (!startsWithinDisplay) {
    return false;
  }

  // is half the screen within the display?
  const midX = state.x + (state.width / 2);
  const midY = state.y + (state.height / 2);
  return !(midX > display.maxX || midY > display.maxY);
}

function getValidWindowPosition(state) {
  // Check if the previous position is out of the viewable area
  // (e.g. because the screen has been plugged off)
  const boundaries = Utils.getDisplayBoundaries();
  const display = boundaries.find((boundary) => {
    return isWithinDisplay(state, boundary);
  });

  if (typeof display === 'undefined') {
    return {};
  }
  return {x: state.x, y: state.y};
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
    });
    if (typeof validPosition.x !== 'undefined' || typeof validPosition.y !== 'undefined') {
      browserWindow.setPosition(validPosition.x || 0, validPosition.y || 0);
    } else {
      browserWindow.center();
    }
  }

  browserWindow.on('restore', handle);
  handle();
}
