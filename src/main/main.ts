// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */
import fs from 'fs';

import path from 'path';

import electron, {BrowserWindow, IpcMainEvent, IpcMainInvokeEvent, Rectangle} from 'electron';
import isDev from 'electron-is-dev';
import installExtension, {REACT_DEVELOPER_TOOLS} from 'electron-devtools-installer';
import log from 'electron-log';
import 'airbnb-js-shims/target/es2015';

import {CombinedConfig, Team, TeamWithTabs} from 'types/config';
import {MentionData} from 'types/notification';
import {RemoteInfo} from 'types/server';
import {Boundaries} from 'types/utils';

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
    EMIT_CONFIGURATION,
    SWITCH_TAB,
    CLOSE_TAB,
    OPEN_TAB,
    SHOW_EDIT_SERVER_MODAL,
    SHOW_REMOVE_SERVER_MODAL,
    UPDATE_SHORTCUT_MENU,
    UPDATE_LAST_ACTIVE,
    GET_AVAILABLE_SPELL_CHECKER_LANGUAGES,
} from 'common/communication';
import Config from 'common/config';
import {MattermostServer} from 'common/servers/MattermostServer';
import {getDefaultTeamWithTabsFromTeam, TAB_FOCALBOARD, TAB_MESSAGING, TAB_PLAYBOOKS} from 'common/tabs/TabView';
import Utils from 'common/utils/util';

import urlUtils from 'common/utils/url';

import {protocols} from '../../electron-builder.json';

import AutoLauncher from './AutoLauncher';
import CriticalErrorHandler from './CriticalErrorHandler';
import upgradeAutoLaunch from './autoLaunch';
import CertificateStore from './certificateStore';
import TrustedOriginsStore from './trustedOrigins';
import {createMenu as createAppMenu} from './menus/app';
import {createMenu as createTrayMenu} from './menus/tray';
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
import {setupBadge, setUnreadBadgeSetting} from './badge';
import {ServerInfo} from './server/serverInfo';

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
let certificateStore: CertificateStore;
let trustedOriginsStore;
let scheme: string;
let appVersion = null;
let config: Config;
let authManager: AuthManager;
let certificateManager: CertificateManager;
let didCheckForAddServerModal = false;

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
    const loadConfig = new Promise<void>((resolve) => {
        config = new Config(app.getPath('userData') + '/config.json');
        config.once('update', (configData) => {
            config.on('update', handleConfigUpdate);
            config.on('synchronize', handleConfigSynchronize);
            config.on('darkModeChange', handleDarkModeChange);
            config.on('error', (error) => {
                log.error(error);
            });
            handleConfigUpdate(configData);

            // can only call this before the app is ready
            if (config.enableHardwareAcceleration === false) {
                app.disableHardwareAcceleration();
            }

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
    if (!config || !config.data) {
        log.error('No config loaded');
        return;
    }
    if (process.env.NODE_ENV !== 'test') {
        app.enableSandbox();
    }
    certificateStore = new CertificateStore(path.resolve(app.getPath('userData'), 'certificate.json'));
    trustedOriginsStore = new TrustedOriginsStore(path.resolve(app.getPath('userData'), 'trustedOrigins.json'));
    trustedOriginsStore.load();

    // prevent using a different working directory, which happens on windows running after installation.
    const expectedPath = path.dirname(process.execPath);
    if (process.cwd() !== expectedPath && !isDev) {
        log.warn(`Current working directory is ${process.cwd()}, changing into ${expectedPath}`);
        process.chdir(expectedPath);
    }

    refreshTrayImages(config.trayIconTheme);

    // If there is already an instance, quit this one
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.exit();
        global.willAppQuit = true;
    }

    allowProtocolDialog.init();

    authManager = new AuthManager(config.data, trustedOriginsStore);
    certificateManager = new CertificateManager();

    if (isDev && process.env.NODE_ENV !== 'test') {
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
    ipcMain.on(UPDATE_SHORTCUT_MENU, handleUpdateShortcutMenuEvent);
    ipcMain.on(FOCUS_BROWSERVIEW, WindowManager.focusBrowserView);
    ipcMain.on(UPDATE_LAST_ACTIVE, handleUpdateLastActive);

    if (process.platform !== 'darwin') {
        ipcMain.on('open-app-menu', handleOpenAppMenu);
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
    ipcMain.on(WINDOW_CLOSE, WindowManager.close);
    ipcMain.on(WINDOW_MAXIMIZE, WindowManager.maximize);
    ipcMain.on(WINDOW_MINIMIZE, WindowManager.minimize);
    ipcMain.on(WINDOW_RESTORE, WindowManager.restore);
    ipcMain.on(SHOW_SETTINGS_WINDOW, WindowManager.showSettingsWindow);
    ipcMain.handle(GET_AVAILABLE_SPELL_CHECKER_LANGUAGES, handleGetAvailableSpellCheckerLanguages);
    ipcMain.handle(GET_DOWNLOAD_LOCATION, handleSelectDownload);
}

//
// config event handlers
//

function handleConfigUpdate(newConfig: CombinedConfig) {
    if (!newConfig) {
        return;
    }
    if (process.platform === 'win32' || process.platform === 'linux') {
        const appLauncher = new AutoLauncher();
        const autoStartTask = config.autostart ? appLauncher.enable() : appLauncher.disable();
        autoStartTask.then(() => {
            log.info('config.autostart has been configured:', newConfig.autostart);
        }).catch((err) => {
            log.error('error:', err);
        });
        WindowManager.setConfig(newConfig);
        if (authManager) {
            authManager.handleConfigUpdate(newConfig);
        }
        setUnreadBadgeSetting(newConfig && newConfig.showUnreadBadge);
        updateSpellCheckerLocales();
    }

    ipcMain.emit('update-menu', true, config);
    ipcMain.emit(EMIT_CONFIGURATION, true, newConfig);
}

function handleConfigSynchronize() {
    if (!config.data) {
        return;
    }

    // TODO: send this to server manager
    WindowManager.setConfig(config.data);
    setUnreadBadgeSetting(config.data.showUnreadBadge);
    if (config.data.downloadLocation) {
        try {
            app.setPath('downloads', config.data.downloadLocation);
        } catch (e) {
            log.error(`There was a problem trying to set the default download path: ${e}`);
        }
    }
    if (app.isReady()) {
        WindowManager.sendToRenderer(RELOAD_CONFIGURATION);
    }

    if (process.platform === 'win32' && !didCheckForAddServerModal && typeof config.registryConfigData !== 'undefined') {
        didCheckForAddServerModal = true;
        updateServerInfos(config.teams);
        WindowManager.initializeCurrentServerName();
        if (config.teams.length === 0) {
            handleNewServerModal();
        }
    }
}

function handleReloadConfig() {
    config.reload();
    WindowManager.setConfig(config.data!);
}

function handleAppVersion() {
    return {
        name: app.getName(),
        version: app.getVersion(),
    };
}

function handleDarkModeChange(darkMode: boolean) {
    refreshTrayImages(config.trayIconTheme);
    WindowManager.sendToRenderer(DARK_MODE_CHANGE, darkMode);
    WindowManager.updateLoadingScreenDarkMode(darkMode);

    ipcMain.emit(EMIT_CONFIGURATION, true, config.data);
}

//
// app event handlers
//

// activate first app instance, subsequent instances will quit themselves
function handleAppSecondInstance(event: Event, argv: string[]) {
    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    const deeplinkingUrl = getDeeplinkingURL(argv);
    WindowManager.showMainWindow(deeplinkingUrl);
}

function handleAppWindowAllClosed() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
}

function handleAppBrowserWindowCreated(event: Event, newWindow: BrowserWindow) {
    // Screen cannot be required before app is ready
    resizeScreen(newWindow);
}

function handleAppActivate() {
    WindowManager.showMainWindow();
}

function handleAppBeforeQuit() {
    // Make sure tray icon gets removed if the user exits via CTRL-Q
    destroyTray();
    global.willAppQuit = true;
}

function handleQuit(e: IpcMainEvent, reason: string, stack: string) {
    log.error(`Exiting App. Reason: ${reason}`);
    log.info(`Stacktrace:\n${stack}`);
    handleAppBeforeQuit();
    app.quit();
}

function handleSelectCertificate(event: electron.Event, webContents: electron.WebContents, url: string, list: electron.Certificate[], callback: (certificate?: electron.Certificate | undefined) => void) {
    certificateManager.handleSelectCertificate(event, webContents, url, list, callback);
}

function handleAppCertificateError(event: electron.Event, webContents: electron.WebContents, url: string, error: string, certificate: electron.Certificate, callback: (isTrusted: boolean) => void) {
    const parsedURL = new URL(url);
    if (!parsedURL) {
        return;
    }
    const origin = parsedURL.origin;
    if (certificateStore.isExplicitlyUntrusted(origin)) {
        event.preventDefault();
        log.warn(`Ignoring previously untrusted certificate for ${origin}`);
        callback(false);
    } else if (certificateStore.isTrusted(origin, certificate)) {
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
        if (!mainWindow) {
            return;
        }
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
                        checkboxChecked: false,
                        checkboxLabel: "Don't ask again",
                    });
                }
                return {response, checkboxChecked: false};
            }).then(
            ({response: responseTwo, checkboxChecked}) => {
                if (responseTwo === 0) {
                    certificateStore.add(origin, certificate);
                    certificateStore.save();
                    certificateErrorCallbacks.get(errorID)(true);
                    certificateErrorCallbacks.delete(errorID);
                    webContents.loadURL(url);
                } else {
                    if (checkboxChecked) {
                        certificateStore.add(origin, certificate, true);
                        certificateStore.save();
                    }
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

function handleAppLogin(event: electron.Event, webContents: electron.WebContents, request: electron.AuthenticationResponseDetails, authInfo: electron.AuthInfo, callback: (username?: string | undefined, password?: string | undefined) => void) {
    authManager.handleAppLogin(event, webContents, request, authInfo, callback);
}

function handleAppGPUProcessCrashed(event: electron.Event, killed: boolean) {
    log.error(`The GPU process has crashed (killed = ${killed})`);
}

function openDeepLink(deeplinkingUrl: string) {
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

function handleSwitchServer(event: IpcMainEvent, serverName: string) {
    WindowManager.switchServer(serverName);
}

function handleSwitchTab(event: IpcMainEvent, serverName: string, tabName: string) {
    WindowManager.switchTab(serverName, tabName);
}

function handleCloseTab(event: IpcMainEvent, serverName: string, tabName: string) {
    const teams = config.teams;
    teams.forEach((team) => {
        if (team.name === serverName) {
            team.tabs.forEach((tab) => {
                if (tab.name === tabName) {
                    tab.isOpen = false;
                }
            });
        }
    });
    const nextTab = teams.find((team) => team.name === serverName)!.tabs.filter((tab) => tab.isOpen)[0].name;
    WindowManager.switchTab(serverName, nextTab);
    config.set('teams', teams);
}

function handleOpenTab(event: IpcMainEvent, serverName: string, tabName: string) {
    const teams = config.teams;
    teams.forEach((team) => {
        if (team.name === serverName) {
            team.tabs.forEach((tab) => {
                if (tab.name === tabName) {
                    tab.isOpen = true;
                }
            });
        }
    });
    WindowManager.switchTab(serverName, tabName);
    config.set('teams', teams);
}

function handleNewServerModal() {
    const html = getLocalURLString('newServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

    const mainWindow = WindowManager.getMainWindow();
    if (!mainWindow) {
        return;
    }
    const modalPromise = addModal<unknown, Team>('newServer', html, modalPreload, {}, mainWindow, config.teams.length === 0);
    if (modalPromise) {
        modalPromise.then((data) => {
            const teams = config.teams;
            const order = teams.length;
            const newTeam = getDefaultTeamWithTabsFromTeam({...data, order});
            teams.push(newTeam);
            config.set('teams', teams);
            updateServerInfos([newTeam]);
            WindowManager.switchServer(newTeam.name, true);
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

function handleEditServerModal(e: IpcMainEvent, name: string) {
    const html = getLocalURLString('editServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

    const mainWindow = WindowManager.getMainWindow();
    if (!mainWindow) {
        return;
    }
    const serverIndex = config.teams.findIndex((team) => team.name === name);
    if (serverIndex < 0) {
        return;
    }
    const modalPromise = addModal<Team, Team>('editServer', html, modalPreload, config.teams[serverIndex], mainWindow);
    if (modalPromise) {
        modalPromise.then((data) => {
            const teams = config.teams;
            teams[serverIndex].name = data.name;
            teams[serverIndex].url = data.url;
            config.set('teams', teams);
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already an edit server modal');
    }
}

function handleRemoveServerModal(e: IpcMainEvent, name: string) {
    const html = getLocalURLString('removeServer.html');

    const modalPreload = getLocalPreload('modalPreload.js');

    const mainWindow = WindowManager.getMainWindow();
    if (!mainWindow) {
        return;
    }
    const modalPromise = addModal<string, boolean>('removeServer', html, modalPreload, name, mainWindow);
    if (modalPromise) {
        modalPromise.then((remove) => {
            if (remove) {
                const teams = config.teams;
                const removedTeam = teams.findIndex((team) => team.name === name);
                if (removedTeam < 0) {
                    return;
                }
                const removedOrder = teams[removedTeam].order;
                teams.splice(removedTeam, 1);
                teams.forEach((value) => {
                    if (value.order > removedOrder) {
                        value.order--;
                    }
                });
                config.set('teams', teams);
            }
        }).catch((e) => {
            // e is undefined for user cancellation
            if (e) {
                log.error(`there was an error in the edit server modal: ${e}`);
            }
        });
    } else {
        log.warn('There is already an edit server modal');
    }
}

function updateSpellCheckerLocales() {
    if (config.data?.spellCheckerLocales.length && app.isReady()) {
        session.defaultSession.setSpellCheckerLanguages(config.data?.spellCheckerLocales);
    }
}

function initializeAfterAppReady() {
    updateServerInfos(config.teams);
    app.setAppUserModelId('Mattermost.Desktop'); // Use explicit AppUserModelID
    const defaultSession = session.defaultSession;

    if (process.platform !== 'darwin') {
        defaultSession.on('spellcheck-dictionary-download-failure', (event, lang) => {
            if (config.spellCheckerURL) {
                log.error(`There was an error while trying to load the dictionary definitions for ${lang} fromfully the specified url. Please review you have access to the needed files. Url used was ${config.spellCheckerURL}`);
            } else {
                log.warn(`There was an error while trying to download the dictionary definitions for ${lang}, spellchecking might not work properly.`);
            }
        });

        if (config.spellCheckerURL) {
            const spellCheckerURL = config.spellCheckerURL.endsWith('/') ? config.spellCheckerURL : `${config.spellCheckerURL}/`;
            log.info(`Configuring spellchecker using download URL: ${spellCheckerURL}`);
            defaultSession.setSpellCheckerDictionaryDownloadURL(spellCheckerURL);

            defaultSession.on('spellcheck-dictionary-download-success', (event, lang) => {
                log.info(`Dictionary definitions downloaded successfully for ${lang}`);
            });
        }
        updateSpellCheckerLocales();
    }

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

    initCookieManager(defaultSession);

    WindowManager.showMainWindow(deeplinkingURL);

    criticalErrorHandler.setMainWindow(WindowManager.getMainWindow()!);

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

    defaultSession.on('will-download', (event, item, webContents) => {
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
            defaultPath: path.resolve(config.downloadLocation, filename),
            filters,
        });

        item.on('done', (doneEvent, state) => {
            if (state === 'completed') {
                displayDownloadCompleted(filename, item.savePath, WindowManager.getServerNameByWebContentsId(webContents.id) || '');
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
        callback(urlUtils.isTrustedURL(requestingURL, config.teams));
    });

    // only check for non-Windows, as with Windows we have to wait for GPO teams
    if (process.platform !== 'win32' || typeof config.registryConfigData !== 'undefined') {
        if (config.teams.length === 0) {
            setTimeout(() => {
                handleNewServerModal();
            }, 200);
        }
    }
}

//
// ipc communication event handlers
//

function handleMentionNotification(event: IpcMainEvent, title: string, body: string, channel: {id: string}, teamId: string, url: string, silent: boolean, data: MentionData) {
    displayMention(title, body, channel, teamId, url, silent, event.sender, data);
}

function updateServerInfos(teams: TeamWithTabs[]) {
    const serverInfos: Array<Promise<RemoteInfo | string | undefined>> = [];
    teams.forEach((team) => {
        const serverInfo = new ServerInfo(new MattermostServer(team.name, team.url));
        serverInfos.push(serverInfo.promise);
    });
    Promise.all(serverInfos).then((data: Array<RemoteInfo | string | undefined>) => {
        const teams = config.teams;
        teams.forEach((team) => openExtraTabs(data, team));
        config.set('teams', teams);
    }).catch((reason: any) => {
        log.error('Error getting server infos', reason);
    });
}

function openExtraTabs(data: Array<RemoteInfo | string | undefined>, team: TeamWithTabs) {
    const remoteInfo = data.find((info) => info && typeof info !== 'string' && info.name === team.name) as RemoteInfo;
    if (remoteInfo) {
        team.tabs.forEach((tab) => {
            if (tab.name !== TAB_MESSAGING && remoteInfo.serverVersion && Utils.isVersionGreaterThanOrEqualTo(remoteInfo.serverVersion, '6.0.0')) {
                if (tab.name === TAB_PLAYBOOKS && remoteInfo.hasPlaybooks && tab.isOpen !== false) {
                    log.info(`opening ${team.name}___${tab.name} on hasPlaybooks`);
                    tab.isOpen = true;
                }
                if (tab.name === TAB_FOCALBOARD && remoteInfo.hasFocalboard && tab.isOpen !== false) {
                    log.info(`opening ${team.name}___${tab.name} on hasFocalboard`);
                    tab.isOpen = true;
                }
            }
        });
    }
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

function handleUpdateMenuEvent(event: IpcMainEvent, menuConfig: Config) {
    const aMenu = createAppMenu(menuConfig);
    Menu.setApplicationMenu(aMenu);
    aMenu.addListener('menu-will-close', handleCloseAppMenu);

    // set up context menu for tray icon
    if (shouldShowTrayIcon()) {
        const tMenu = createTrayMenu(menuConfig.data!);
        setTrayMenu(tMenu);
    }
}

function handleUpdateShortcutMenuEvent(event: IpcMainEvent) {
    handleUpdateMenuEvent(event, config);
}

async function handleSelectDownload(event: IpcMainInvokeEvent, startFrom: string) {
    const message = 'Specify the folder where files will download';
    const result = await dialog.showOpenDialog({defaultPath: startFrom || config.downloadLocation,
        message,
        properties:
     ['openDirectory', 'createDirectory', 'dontAddToRecent', 'promptToCreate']});
    return result.filePaths[0];
}

//
// helper functions
//

function getDeeplinkingURL(args: string[]) {
    if (Array.isArray(args) && args.length) {
    // deeplink urls should always be the last argument, but may not be the first (i.e. Windows with the app already running)
        const url = args[args.length - 1];
        if (url && scheme && url.startsWith(scheme) && urlUtils.isValidURI(url)) {
            return url;
        }
    }
    return undefined;
}

function shouldShowTrayIcon() {
    return config.showTrayIcon || process.platform === 'win32';
}

function wasUpdated(lastAppVersion?: string) {
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

function isWithinDisplay(state: Rectangle, display: Boundaries) {
    const startsWithinDisplay = !(state.x > display.maxX || state.y > display.maxY || state.x < display.minX || state.y < display.minY);
    if (!startsWithinDisplay) {
        return false;
    }

    // is half the screen within the display?
    const midX = state.x + (state.width / 2);
    const midY = state.y + (state.height / 2);
    return !(midX > display.maxX || midY > display.maxY);
}

function getValidWindowPosition(state: Rectangle) {
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

function resizeScreen(browserWindow: BrowserWindow) {
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
function handleUpdateLastActive(event: IpcMainEvent, serverName: string, viewName: string) {
    const teams = config.teams;
    teams.forEach((team) => {
        if (team.name === serverName) {
            const viewOrder = team?.tabs.find((tab) => tab.name === viewName)?.order || 0;
            team.lastActiveTab = viewOrder;
        }
    });
    config.set('teams', teams);
    config.set('lastActiveTeam', teams.find((team) => team.name === serverName)?.order || 0);
}

function handleGetAvailableSpellCheckerLanguages() {
    return session.defaultSession.availableSpellCheckerLanguages;
}
