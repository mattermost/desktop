// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, ipcMain, protocol, screen, session} from 'electron';
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';
import isDev from 'electron-is-dev';
import log from 'electron-log';

import {
    SWITCH_SERVER,
    FOCUS_BROWSERVIEW,
    QUIT,
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
    SWITCH_TAB,
    CLOSE_TAB,
    OPEN_TAB,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    UPDATE_SHORTCUT_MENU,
    UPDATE_LAST_ACTIVE,
    GET_AVAILABLE_SPELL_CHECKER_LANGUAGES,
    USER_ACTIVITY_UPDATE,
    START_UPGRADE,
    START_UPDATE_DOWNLOAD,
    PING_DOMAIN,
    MAIN_WINDOW_SHOWN,
    OPEN_APP_MENU,
} from 'common/communication';
import Config from 'common/config';
import urlUtils from 'common/utils/url';

import AllowProtocolDialog from 'main/allowProtocolDialog';
import AppVersionManager from 'main/AppVersionManager';
import AuthManager from 'main/authManager';
import AutoLauncher from 'main/AutoLauncher';
import updateManager from 'main/autoUpdater';
import {setupBadge} from 'main/badge';
import CertificateManager from 'main/certificateManager';
import {updatePaths} from 'main/constants';
import CriticalErrorHandler from 'main/CriticalErrorHandler';
import downloadsManager from 'main/downloadsManager';
import i18nManager from 'main/i18nManager';
import parseArgs from 'main/ParseArgs';
import TrustedOriginsStore from 'main/trustedOrigins';
import {refreshTrayImages, setupTray} from 'main/tray/tray';
import {getLocalURLString} from 'main/utils';
import UserActivityMonitor from 'main/UserActivityMonitor';
import WindowManager from 'main/windows/windowManager';
import WebRequestManager from 'main/webRequest/webRequestManager';

import {protocols} from '../../../electron-builder.json';

import {
    handleAppBeforeQuit,
    handleAppBrowserWindowCreated,
    handleAppCertificateError,
    handleAppSecondInstance,
    handleAppWillFinishLaunching,
    handleAppWindowAllClosed,
    handleChildProcessGone,
} from './app';
import {handleConfigUpdate, handleDarkModeChange} from './config';
import {
    handleMainWindowIsShown,
    handleAppVersion,
    handleCloseTab,
    handleEditServerModal,
    handleMentionNotification,
    handleNewServerModal,
    handleOpenAppMenu,
    handleOpenTab,
    handleQuit,
    handleReloadConfig,
    handleRemoveServerModal,
    handleSelectDownload,
    handleSwitchServer,
    handleSwitchTab,
    handleUpdateLastActive,
    handlePingDomain,
} from './intercom';
import {
    clearAppCache,
    getDeeplinkingURL,
    handleUpdateMenuEvent,
    shouldShowTrayIcon,
    updateServerInfos,
    updateSpellCheckerLocales,
    wasUpdated,
    initCookieManager,
    migrateMacAppStore,
} from './utils';

export const mainProtocol = protocols?.[0]?.schemes?.[0];

/**
 * Main entry point for the application, ensures that everything initializes in the proper order
 */
export async function initialize() {
    process.on('uncaughtException', CriticalErrorHandler.processUncaughtExceptionHandler.bind(CriticalErrorHandler));
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

    initializeScreenEventListeners();

    // no need to continue initializing if app is quitting
    if (global.willAppQuit) {
        return;
    }

    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (__IS_MAC_APP_STORE__) {
        migrateMacAppStore();
    }

    // initialization that should run once the app is ready
    initializeInterCommunicationEventListeners();
    initializeAfterAppReady();
}

//
// initialization sub functions
//

function initializeArgs() {
    global.args = parseArgs(process.argv.slice(1));

    global.isDev = isDev && !global.args.disableDevMode; // this doesn't seem to be right and isn't used as the single source of truth

    if (global.args.dataDir) {
        app.setPath('userData', path.resolve(global.args.dataDir));
        updatePaths(true);
    }
}

async function initializeConfig() {
    return new Promise<void>((resolve) => {
        Config.once('update', (configData) => {
            Config.on('update', handleConfigUpdate);
            Config.on('darkModeChange', handleDarkModeChange);
            Config.on('error', (error) => {
                log.error(error);
            });
            handleConfigUpdate(configData);

            // can only call this before the app is ready
            // eslint-disable-next-line no-undef
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (Config.enableHardwareAcceleration === false || __DISABLE_GPU__) {
                app.disableHardwareAcceleration();
            }

            resolve();
        });
        Config.init();
    });
}

function initializeAppEventListeners() {
    app.on('second-instance', handleAppSecondInstance);
    app.on('window-all-closed', handleAppWindowAllClosed);
    app.on('browser-window-created', handleAppBrowserWindowCreated);
    app.on('activate', () => WindowManager.showMainWindow());
    app.on('before-quit', handleAppBeforeQuit);
    app.on('certificate-error', handleAppCertificateError);
    app.on('select-client-certificate', CertificateManager.handleSelectCertificate);
    app.on('child-process-gone', handleChildProcessGone);
    app.on('login', AuthManager.handleAppLogin);
    app.on('will-finish-launching', handleAppWillFinishLaunching);
}

function initializeScreenEventListeners() {
    screen.on('display-removed', WindowManager.displayRemoved);
    screen.on('display-metrics-changed', WindowManager.displayMetricsChanged);
}

function initializeBeforeAppReady() {
    if (!Config.data) {
        log.error('No config loaded');
        return;
    }
    if (process.env.NODE_ENV !== 'test') {
        app.enableSandbox();
    }
    TrustedOriginsStore.load();

    // prevent using a different working directory, which happens on windows running after installation.
    const expectedPath = path.dirname(process.execPath);
    if (process.cwd() !== expectedPath && !isDev) {
        log.warn(`Current working directory is ${process.cwd()}, changing into ${expectedPath}`);
        process.chdir(expectedPath);
    }

    refreshTrayImages(Config.trayIconTheme);

    // If there is already an instance, quit this one
    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!__IS_MAC_APP_STORE__) {
        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
            app.exit();
            global.willAppQuit = true;
        }
    }

    AllowProtocolDialog.init();

    if (isDev && process.env.NODE_ENV !== 'test') {
        log.info('In development mode, deeplinking is disabled');
    } else if (mainProtocol) {
        app.setAsDefaultProtocolClient(mainProtocol);
    }

    protocol.registerSchemesAsPrivileged([
        {
            scheme: 'mm-desktop',
            privileges: {
                standard: true,
                supportFetchAPI: true,
            },
        },
    ]);
}

function initializeInterCommunicationEventListeners() {
    ipcMain.on(RELOAD_CONFIGURATION, handleReloadConfig);
    ipcMain.on(NOTIFY_MENTION, handleMentionNotification);
    ipcMain.handle('get-app-version', handleAppVersion);
    ipcMain.on(UPDATE_SHORTCUT_MENU, handleUpdateMenuEvent);
    ipcMain.on(FOCUS_BROWSERVIEW, WindowManager.focusBrowserView);
    ipcMain.on(UPDATE_LAST_ACTIVE, handleUpdateLastActive);

    if (process.platform !== 'darwin') {
        ipcMain.on(OPEN_APP_MENU, handleOpenAppMenu);
    }

    ipcMain.on(SWITCH_SERVER, handleSwitchServer);
    ipcMain.on(SWITCH_TAB, handleSwitchTab);
    ipcMain.on(CLOSE_TAB, handleCloseTab);
    ipcMain.on(OPEN_TAB, handleOpenTab);

    ipcMain.on(QUIT, handleQuit);

    ipcMain.on(DOUBLE_CLICK_ON_WINDOW, WindowManager.handleDoubleClick);

    ipcMain.on(SHOW_NEW_SERVER_MODAL, handleNewServerModal);
    ipcMain.on(SHOW_EDIT_SERVER_MODAL, handleEditServerModal);
    ipcMain.on(SHOW_REMOVE_SERVER_MODAL, handleRemoveServerModal);
    ipcMain.on(MAIN_WINDOW_SHOWN, handleMainWindowIsShown);
    ipcMain.on(WINDOW_CLOSE, WindowManager.close);
    ipcMain.on(WINDOW_MAXIMIZE, WindowManager.maximize);
    ipcMain.on(WINDOW_MINIMIZE, WindowManager.minimize);
    ipcMain.on(WINDOW_RESTORE, WindowManager.restore);
    ipcMain.on(SHOW_SETTINGS_WINDOW, WindowManager.showSettingsWindow);
    ipcMain.handle(GET_AVAILABLE_SPELL_CHECKER_LANGUAGES, () => session.defaultSession.availableSpellCheckerLanguages);
    ipcMain.handle(GET_DOWNLOAD_LOCATION, handleSelectDownload);
    ipcMain.on(START_UPDATE_DOWNLOAD, handleStartDownload);
    ipcMain.on(START_UPGRADE, handleStartUpgrade);
    ipcMain.handle(PING_DOMAIN, handlePingDomain);
}

function initializeAfterAppReady() {
    updateServerInfos(Config.teams);
    app.setAppUserModelId('Mattermost.Desktop'); // Use explicit AppUserModelID
    const defaultSession = session.defaultSession;

    defaultSession.protocol.registerFileProtocol('mm-desktop', (request, callback) => {
        const parsedURL = urlUtils.parseURL(request.url);
        if (parsedURL?.pathname === '/mattermost_bundle.js') {
            callback(getLocalURLString('mattermost_bundle.js').replace(/file:\/\/\//, ''));
            return;
        }
        if (parsedURL?.pathname === '/src_renderer_mattermost_tsx_bundle.js') {
            callback(getLocalURLString('src_renderer_mattermost_tsx_bundle.js').replace(/file:\/\/\//, ''));
            return;
        }
        callback(getLocalURLString('mattermost.html').replace(/file:\/\/\//, ''));
    });

    WebRequestManager.initialize();

    if (process.platform !== 'darwin') {
        defaultSession.on('spellcheck-dictionary-download-failure', (event, lang) => {
            if (Config.spellCheckerURL) {
                log.error(`There was an error while trying to load the dictionary definitions for ${lang} from fully the specified url. Please review you have access to the needed files. Url used was ${Config.spellCheckerURL}`);
            } else {
                log.warn(`There was an error while trying to download the dictionary definitions for ${lang}, spellchecking might not work properly.`);
            }
        });

        if (Config.spellCheckerURL) {
            const spellCheckerURL = Config.spellCheckerURL.endsWith('/') ? Config.spellCheckerURL : `${Config.spellCheckerURL}/`;
            log.info(`Configuring spellchecker using download URL: ${spellCheckerURL}`);
            defaultSession.setSpellCheckerDictionaryDownloadURL(spellCheckerURL);

            defaultSession.on('spellcheck-dictionary-download-success', (event, lang) => {
                log.info(`Dictionary definitions downloaded successfully for ${lang}`);
            });
        }
        updateSpellCheckerLocales();
    }

    if (wasUpdated(AppVersionManager.lastAppVersion)) {
        clearAppCache();
    }
    AppVersionManager.lastAppVersion = app.getVersion();

    if (typeof Config.canUpgrade === 'undefined') {
        // windows might not be ready, so we have to wait until it is
        Config.once('update', () => {
            log.debug('Initialize.checkForUpdates');
            if (Config.canUpgrade && Config.autoCheckForUpdates) {
                setTimeout(() => {
                    updateManager.checkForUpdates(false);
                }, 5000);
            } else {
                log.info(`Autoupgrade disabled: ${Config.canUpgrade}`);
            }
        });
    } else if (Config.canUpgrade && Config.autoCheckForUpdates) {
        setTimeout(() => {
            updateManager.checkForUpdates(false);
        }, 5000);
    } else {
        log.info(`Autoupgrade disabled: ${Config.canUpgrade}`);
    }

    if (!global.isDev) {
        AutoLauncher.upgradeAutoLaunch();
    }

    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (global.isDev || __IS_NIGHTLY_BUILD__) {
        installExtension(REACT_DEVELOPER_TOOLS).
            then((name) => log.info(`Added Extension:  ${name}`)).
            catch((err) => log.error('An error occurred: ', err));
    }

    let deeplinkingURL;

    // Protocol handler for win32
    if (process.platform === 'win32') {
        const args = process.argv.slice(1);
        if (Array.isArray(args) && args.length > 0) {
            deeplinkingURL = getDeeplinkingURL(args);
        }
    }

    initCookieManager(defaultSession);

    WindowManager.showMainWindow(deeplinkingURL);

    CriticalErrorHandler.setMainWindow(WindowManager.getMainWindow()!);

    // listen for status updates and pass on to renderer
    UserActivityMonitor.on('status', (status) => {
        log.debug('Initialize.UserActivityMonitor.on(status)', status);
        WindowManager.sendToMattermostViews(USER_ACTIVITY_UPDATE, status);
    });

    // start monitoring user activity (needs to be started after the app is ready)
    UserActivityMonitor.startMonitoring();

    if (shouldShowTrayIcon()) {
        setupTray(Config.trayIconTheme);
    }
    setupBadge();

    defaultSession.on('will-download', downloadsManager.handleNewDownload);

    // needs to be done after app ready
    // must be done before update menu
    if (Config.appLanguage) {
        i18nManager.setLocale(Config.appLanguage);
    } else if (!i18nManager.setLocale(app.getLocale())) {
        i18nManager.setLocale(app.getLocaleCountryCode());
    }

    handleUpdateMenuEvent();

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
    defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
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
        callback(urlUtils.isTrustedURL(requestingURL, Config.teams));
    });

    // only check for non-Windows, as with Windows we have to wait for GPO teams
    if (process.platform !== 'win32' || typeof Config.registryConfigData !== 'undefined') {
        handleMainWindowIsShown();
    }
}

function handleStartDownload() {
    if (updateManager) {
        updateManager.handleDownload();
    }
}

function handleStartUpgrade() {
    if (updateManager) {
        updateManager.handleUpdate();
    }
}
