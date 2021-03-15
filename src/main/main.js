// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai
import fs from 'fs';

import path from 'path';

import electron from 'electron';
import isDev from 'electron-is-dev';
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';
import log from 'electron-log';
import 'airbnb-js-shims/target/es2015';

import Utils from 'common/utils/util';
import urlUtils from 'common/utils/url';

import {
    SWITCH_SERVER,
    FOCUS_BROWSERVIEW,
    QUIT,
    DARK_MODE_CHANGE,
    DOUBLE_CLICK_ON_WINDOW,
    SHOW_NEW_SERVER_MODAL,
    WINDOW_CLOSE,
    WINDOW_MAXIMIZE,
    WINDOW_MINIMIZE,
    WINDOW_RESTORE,
    NOTIFY_MENTION,
    GET_DOWNLOAD_LOCATION,
    SHOW_SETTINGS_WINDOW,
    RELOAD_CONFIGURATION,
    USER_ACTIVITY_UPDATE,
} from 'common/communication';
import Config from 'common/config';

import {protocols} from '../../electron-builder.json';

import AutoLauncher from './AutoLauncher';
import CriticalErrorHandler from './CriticalErrorHandler';
import upgradeAutoLaunch from './autoLaunch';
import CertificateStore from './certificateStore';
import TrustedOriginsStore from './trustedOrigins';
import appMenu from './menus/app';
import trayMenu from './menus/tray';
import allowProtocolDialog from './allowProtocolDialog';
import AppVersionManager from './AppVersionManager';
import initCookieManager from './cookieManager';
import UserActivityMonitor from './UserActivityMonitor';
import * as WindowManager from './windows/windowManager';
import {displayMention, displayDownloadCompleted} from './notifications';

import parseArgs from './ParseArgs';
import {addModal} from './views/modalManager';
import {getLocalURLString, getLocalPreload} from './utils';
import {destroyTray, refreshTrayImages, setTrayMenu, setupTray} from './tray/tray';
import {AuthManager} from './authManager';
import {CertificateManager} from './certificateManager';
import {setupBadge} from './badge';

if (process.env.NODE_ENV !== 'production' && module.hot) {
    module.hot.accept();
}

// pull out required electron components like this
// as not all components can be referenced before the app is ready
const {
    app,
    Menu,
    ipcMain,
    dialog,
    session,
} = electron;
const criticalErrorHandler = new CriticalErrorHandler();
const userActivityMonitor = new UserActivityMonitor();
const certificateErrorCallbacks = new Map();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let certificateStore = null;
let trustedOriginsStore = null;
let scheme = null;
let appVersion = null;
let config = null;
let authManager = null;
let certificateManager = null;

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

    refreshTrayImages(config.trayIconTheme);

    // If there is already an instance, quit this one
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.exit();
        global.willAppQuit = true;
    }

    allowProtocolDialog.init();

    authManager = new AuthManager(config, trustedOriginsStore);
    certificateManager = new CertificateManager();

    if (isDev) {
        log.info('In development mode, deeplinking is disabled');
    } else if (protocols && protocols[0] && protocols[0].schemes && protocols[0].schemes[0]) {
        scheme = protocols[0].schemes[0];
        app.setAsDefaultProtocolClient(scheme);
    }
}

function initializeInterCommunicationEventListeners() {
    ipcMain.on(RELOAD_CONFIGURATION, handleReloadConfig);
    ipcMain.on(NOTIFY_MENTION, handleMentionNotification);
    ipcMain.handle('get-app-version', handleAppVersion);
    ipcMain.on('update-menu', handleUpdateMenuEvent);
    ipcMain.on(FOCUS_BROWSERVIEW, WindowManager.focusBrowserView);

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
    ipcMain.on(SHOW_SETTINGS_WINDOW, WindowManager.showSettingsWindow);
    ipcMain.handle(GET_DOWNLOAD_LOCATION, handleSelectDownload);
}

//
// config event handlers
//

function handleConfigUpdate(newConfig) {
    if (process.platform === 'win32' || process.platform === 'linux') {
        const appLauncher = new AutoLauncher();
        const autoStartTask = config.autostart ? appLauncher.enable() : appLauncher.disable();
        autoStartTask.then(() => {
            log.info('config.autostart has been configured:', newConfig.autostart);
        }).catch((err) => {
            log.error('error:', err);
        });
        WindowManager.setConfig(newConfig.data);
    }

    ipcMain.emit('update-menu', true, config);
}

function handleConfigSynchronize() {
    // TODO: send this to server manager
    WindowManager.setConfig(config.data);
    if (app.isReady()) {
        WindowManager.sendToRenderer(RELOAD_CONFIGURATION);
    }
}

function handleReloadConfig() {
    config.reload();
    WindowManager.setConfig(config.data);
}

function handleAppVersion() {
    return {
        name: app.getName(),
        version: app.getVersion(),
    };
}

function handleDarkModeChange(darkMode) {
    refreshTrayImages(config.trayIconTheme);
    WindowManager.sendToRenderer(DARK_MODE_CHANGE, darkMode);
    WindowManager.updateLoadingScreenDarkMode(darkMode);
}

//
// app event handlers
//

// activate first app instance, subsequent instances will quit themselves
function handleAppSecondInstance(event, argv) {
    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    const deeplinkingUrl = getDeeplinkingURL(argv);
    openDeepLink(deeplinkingUrl);
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
    destroyTray();
    global.willAppQuit = true;
}

function handleQuit(e, reason, stack) {
    log.error(`Exiting App. Reason: ${reason}`);
    log.info(`Stacktrace:\n${stack}`);
    handleAppBeforeQuit();
    app.quit();
}

function handleSelectCertificate(event, webContents, url, list, callback) {
    certificateManager.handleSelectCertificate(event, webContents, url, list, callback);
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

function handleAppLogin(event, webContents, request, authInfo, callback) {
    authManager.handleAppLogin(event, webContents, request, authInfo, callback);
}

function handleAppGPUProcessCrashed(event, killed) {
    log.error(`The GPU process has crashed (killed = ${killed})`);
}

function openDeepLink(deeplinkingUrl) {
    try {
        WindowManager.showMainWindow(deeplinkingUrl);
    } catch (err) {
        log.error(`There was an error opening the deeplinking url: ${err}`);
    }
}

function handleAppWillFinishLaunching() {
    // Protocol handler for osx
    app.on('open-url', (event, url) => {
        log.info(`Handling deeplinking url: ${url}`);
        event.preventDefault();
        const deeplinkingUrl = getDeeplinkingURL([url]);
        if (deeplinkingUrl) {
            if (app.isReady() && deeplinkingUrl) {
                openDeepLink(deeplinkingUrl);
            } else {
                app.once('ready', () => openDeepLink(deeplinkingUrl));
            }
        }
    });
}

function handleSwitchServer(event, serverName) {
    WindowManager.switchServer(serverName);
}

function handleNewServerModal() {
    const html = getLocalURLString('newServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

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
                log.error(`there was an error in the new server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already a new server modal');
    }
}

function initializeAfterAppReady() {
    app.setAppUserModelId('Mattermost.Desktop'); // Use explicit AppUserModelID

    const appVersionJson = path.join(app.getPath('userData'), 'app-state.json');
    appVersion = new AppVersionManager(appVersionJson);
    if (wasUpdated(appVersion.lastAppVersion)) {
        clearAppCache();
    }
    appVersion.lastAppVersion = app.getVersion();

    if (!global.isDev) {
        upgradeAutoLaunch();
    }

    if (global.isDev) {
        installExtension(REACT_DEVELOPER_TOOLS).
            then((name) => log.info(`Added Extension:  ${name}`)).
            catch((err) => log.error('An error occurred: ', err));
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

    let deeplinkingURL;

    // Protocol handler for win32
    if (process.platform === 'win32') {
        const args = process.argv.slice(1);
        if (Array.isArray(args) && args.length > 0) {
            deeplinkingURL = getDeeplinkingURL(args);
        }
    }

    initCookieManager(session.defaultSession);

    WindowManager.showMainWindow(deeplinkingURL);

    if (config.teams.length === 0) {
        WindowManager.showSettingsWindow();
    }

    criticalErrorHandler.setMainWindow(WindowManager.getMainWindow());

    // listen for status updates and pass on to renderer
    userActivityMonitor.on('status', (status) => {
        WindowManager.sendToMattermostViews(USER_ACTIVITY_UPDATE, status);
    });

    // start monitoring user activity (needs to be started after the app is ready)
    userActivityMonitor.startMonitoring();

    if (shouldShowTrayIcon()) {
        setupTray(config.trayIconTheme);
    }
    setupBadge();

    session.defaultSession.on('will-download', (event, item, webContents) => {
        const filename = item.getFilename();
        const fileElements = filename.split('.');
        const filters = [];
        if (fileElements.length > 1) {
            filters.push({
                name: 'All files',
                extensions: ['*'],
            });
        }
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

    ipcMain.emit('update-menu', true, config);

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
        callback(urlUtils.isTrustedURL(requestingURL, config.teams));
    });
}

//
// ipc communication event handlers
//

function handleMentionNotification(event, title, body, channel, teamId, silent, data) {
    displayMention(title, body, channel, teamId, silent, event.sender, data);
}

function handleOpenAppMenu() {
    const windowMenu = Menu.getApplicationMenu();
    if (!windowMenu) {
        log.error('No application menu found');
        return;
    }
    windowMenu.popup({
        window: WindowManager.getMainWindow(),
        x: 18,
        y: 18,
    });
}

function handleCloseAppMenu() {
    WindowManager.focusBrowserView();
}

function handleUpdateMenuEvent(event, menuConfig) {
    // TODO: this might make sense to move to window manager? so it updates the window referenced if needed.
    const mainWindow = WindowManager.getMainWindow();
    const aMenu = appMenu.createMenu(menuConfig);
    Menu.setApplicationMenu(aMenu);
    aMenu.addListener('menu-will-close', handleCloseAppMenu);

    // set up context menu for tray icon
    if (shouldShowTrayIcon()) {
        const tMenu = trayMenu.createMenu(menuConfig.data);
        setTrayMenu(tMenu, mainWindow);
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
