// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app, ipcMain, nativeTheme, session} from 'electron';
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';
import isDev from 'electron-is-dev';

import {
    SWITCH_SERVER,
    FOCUS_BROWSERVIEW,
    QUIT,
    SHOW_NEW_SERVER_MODAL,
    NOTIFY_MENTION,
    GET_DOWNLOAD_LOCATION,
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
    GET_CONFIGURATION,
    GET_LOCAL_CONFIGURATION,
    UPDATE_CONFIGURATION,
    UPDATE_PATHS,
    UPDATE_SERVER_ORDER,
    UPDATE_TAB_ORDER,
    GET_LAST_ACTIVE,
    GET_ORDERED_SERVERS,
    GET_ORDERED_TABS_FOR_SERVER,
    SERVERS_URL_MODIFIED,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import urlUtils from 'common/utils/url';

import AllowProtocolDialog from 'main/allowProtocolDialog';
import AppVersionManager from 'main/AppVersionManager';
import AuthManager from 'main/authManager';
import AutoLauncher from 'main/AutoLauncher';
import updateManager from 'main/autoUpdater';
import {setupBadge} from 'main/badge';
import CertificateManager from 'main/certificateManager';
import {configPath, updatePaths} from 'main/constants';
import CriticalErrorHandler from 'main/CriticalErrorHandler';
import downloadsManager from 'main/downloadsManager';
import i18nManager from 'main/i18nManager';
import parseArgs from 'main/ParseArgs';
import ServerManager from 'common/servers/serverManager';
import TrustedOriginsStore from 'main/trustedOrigins';
import {refreshTrayImages, setupTray} from 'main/tray/tray';
import UserActivityMonitor from 'main/UserActivityMonitor';
import ViewManager from 'main/views/viewManager';
import WindowManager from 'main/windows/windowManager';
import MainWindow from 'main/windows/mainWindow';

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
import {
    handleConfigUpdate,
    handleDarkModeChange,
    handleGetConfiguration,
    handleGetLocalConfiguration,
    handleUpdateTheme,
    updateConfiguration,
} from './config';
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
    handleRemoveServerModal,
    handleSelectDownload,
    handleSwitchServer,
    handleSwitchTab,
    handleUpdateLastActive,
    handlePingDomain,
    handleGetOrderedServers,
    handleGetOrderedTabsForServer,
    handleGetLastActive,
} from './intercom';
import {
    clearAppCache,
    getDeeplinkingURL,
    handleUpdateMenuEvent,
    shouldShowTrayIcon,
    updateSpellCheckerLocales,
    wasUpdated,
    initCookieManager,
    migrateMacAppStore,
    updateServerInfos,
} from './utils';

export const mainProtocol = protocols?.[0]?.schemes?.[0];

const log = new Logger('App.Initialize');

/**
 * Main entry point for the application, ensures that everything initializes in the proper order
 */
export async function initialize() {
    CriticalErrorHandler.init();
    global.willAppQuit = false;

    // initialization that can run before the app is ready
    initializeArgs();
    await initializeConfig();
    initializeAppEventListeners();
    initializeBeforeAppReady();

    // wait for registry config data to load and app ready event
    await Promise.all([
        app.whenReady(),
        Config.initRegistry(),
    ]);

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
    await initializeAfterAppReady();
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
        Config.init(configPath, app.name, app.getAppPath());
        ipcMain.on(UPDATE_PATHS, () => {
            log.debug('Config.UPDATE_PATHS');

            Config.setConfigPath(configPath);
            if (Config.data) {
                Config.reload();
            }
        });
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

    if (process.platform === 'darwin' || process.platform === 'win32') {
        nativeTheme.on('updated', handleUpdateTheme);
        handleUpdateTheme();
    }
}

function initializeInterCommunicationEventListeners() {
    ipcMain.on(NOTIFY_MENTION, handleMentionNotification);
    ipcMain.handle('get-app-version', handleAppVersion);
    ipcMain.on(UPDATE_SHORTCUT_MENU, handleUpdateMenuEvent);
    ipcMain.on(FOCUS_BROWSERVIEW, ViewManager.focusCurrentView);
    ipcMain.on(UPDATE_LAST_ACTIVE, handleUpdateLastActive);

    if (process.platform !== 'darwin') {
        ipcMain.on(OPEN_APP_MENU, handleOpenAppMenu);
    }

    ipcMain.on(SWITCH_SERVER, handleSwitchServer);
    ipcMain.on(SWITCH_TAB, handleSwitchTab);
    ipcMain.on(CLOSE_TAB, handleCloseTab);
    ipcMain.on(OPEN_TAB, handleOpenTab);

    ipcMain.on(QUIT, handleQuit);

    ipcMain.on(SHOW_NEW_SERVER_MODAL, handleNewServerModal);
    ipcMain.on(SHOW_EDIT_SERVER_MODAL, handleEditServerModal);
    ipcMain.on(SHOW_REMOVE_SERVER_MODAL, handleRemoveServerModal);
    ipcMain.on(MAIN_WINDOW_SHOWN, handleMainWindowIsShown);
    ipcMain.handle(GET_AVAILABLE_SPELL_CHECKER_LANGUAGES, () => session.defaultSession.availableSpellCheckerLanguages);
    ipcMain.handle(GET_DOWNLOAD_LOCATION, handleSelectDownload);
    ipcMain.on(START_UPDATE_DOWNLOAD, handleStartDownload);
    ipcMain.on(START_UPGRADE, handleStartUpgrade);
    ipcMain.handle(PING_DOMAIN, handlePingDomain);
    ipcMain.handle(GET_CONFIGURATION, handleGetConfiguration);
    ipcMain.handle(GET_LOCAL_CONFIGURATION, handleGetLocalConfiguration);
    ipcMain.on(UPDATE_CONFIGURATION, updateConfiguration);

    ipcMain.on(UPDATE_SERVER_ORDER, (event, serverOrder) => ServerManager.updateServerOrder(serverOrder));
    ipcMain.on(UPDATE_TAB_ORDER, (event, serverId, tabOrder) => ServerManager.updateTabOrder(serverId, tabOrder));
    ipcMain.handle(GET_LAST_ACTIVE, handleGetLastActive);
    ipcMain.handle(GET_ORDERED_SERVERS, handleGetOrderedServers);
    ipcMain.handle(GET_ORDERED_TABS_FOR_SERVER, handleGetOrderedTabsForServer);
}

async function initializeAfterAppReady() {
    ServerManager.reloadFromConfig();
    updateServerInfos(ServerManager.getAllServers());
    ServerManager.on(SERVERS_URL_MODIFIED, (serverIds?: string[]) => {
        if (serverIds && serverIds.length) {
            updateServerInfos(serverIds.map((srvId) => ServerManager.getServer(srvId)!));
        }
    });

    app.setAppUserModelId('Mattermost.Desktop'); // Use explicit AppUserModelID
    const defaultSession = session.defaultSession;

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
            log.debug('checkForUpdates');
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

    // listen for status updates and pass on to renderer
    UserActivityMonitor.on('status', (status) => {
        log.debug('UserActivityMonitor.on(status)', status);
        ViewManager.sendToAllViews(USER_ACTIVITY_UPDATE, status);
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
        'clipboard-sanitized-write',
    ];

    // handle permission requests
    // - approve if a supported permission type and the request comes from the renderer or one of the defined servers
    defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        log.debug('permission requested', webContents.getURL(), permission);

        // is the requested permission type supported?
        if (!supportedPermissionTypes.includes(permission)) {
            callback(false);
            return;
        }

        // is the request coming from the renderer?
        const mainWindow = MainWindow.get();
        if (mainWindow && webContents.id === mainWindow.webContents.id) {
            callback(true);
            return;
        }

        const callsWidgetWindow = WindowManager.callsWidgetWindow;
        if (callsWidgetWindow) {
            if (webContents.id === callsWidgetWindow.win.webContents.id) {
                callback(true);
                return;
            }
            if (callsWidgetWindow.popOut && webContents.id === callsWidgetWindow.popOut.webContents.id) {
                callback(true);
                return;
            }
        }

        const requestingURL = webContents.getURL();
        const serverURL = WindowManager.getServerURLFromWebContentsId(webContents.id);

        if (!serverURL) {
            callback(false);
            return;
        }

        // is the requesting url trusted?
        callback(urlUtils.isTrustedURL(requestingURL, serverURL));
    });

    handleMainWindowIsShown();
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
