// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import type {BrowserWindowConstructorOptions, Event, Input, BrowserWindow} from 'electron';
import {app, dialog, ipcMain, screen} from 'electron';
import {EventEmitter} from 'events';

import BaseWindow from 'app/windows/baseWindow';
import AppState from 'common/appState';
import {
    SELECT_NEXT_TAB,
    SELECT_PREVIOUS_TAB,
    GET_FULL_SCREEN_STATUS,
    SERVER_ADDED,
    SERVER_REMOVED,
    SERVER_URL_CHANGED,
    SERVER_NAME_CHANGED,
    SERVER_SWITCHED,
    UPDATE_APPSTATE_FOR_VIEW_ID,
    UPDATE_MENTIONS,
    UPDATE_MENTIONS_FOR_SERVER,
    UPDATE_APPSTATE_FOR_SERVER_ID,
    MAIN_WINDOW_CREATED,
    MAIN_WINDOW_RESIZED,
    MAIN_WINDOW_FOCUSED,
    EMIT_CONFIGURATION,
    EXIT_FULLSCREEN,
    SERVER_LOGGED_IN_CHANGED,
    VIEW_REMOVED,
    VIEW_CREATED,
    VIEW_LIMIT_UPDATED,
    GET_IS_VIEW_LIMIT_REACHED,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, TAB_BAR_HEIGHT} from 'common/utils/constants';
import * as Validator from 'common/Validator';
import ViewManager from 'common/views/viewManager';
import {boundsInfoPath} from 'main/constants';
import {localizeMessage} from 'main/i18nManager';
import performanceMonitor from 'main/performanceMonitor';

import type {SavedWindowState} from 'types/mainWindow';

import {isInsideRectangle, isKDE} from '../../main/utils';

const log = new Logger('MainWindow');

export class MainWindow extends EventEmitter {
    private win?: BaseWindow;
    private savedWindowState?: Partial<SavedWindowState>;

    constructor() {
        super();

        ipcMain.handle(GET_FULL_SCREEN_STATUS, () => this.win?.browserWindow?.isFullScreen());
        ipcMain.on(EMIT_CONFIGURATION, this.handleEmitConfiguration);
        ipcMain.on(EXIT_FULLSCREEN, this.handleExitFullScreen);
        ipcMain.handle(GET_IS_VIEW_LIMIT_REACHED, this.handleGetIsViewLimitReached);

        ServerManager.on(SERVER_ADDED, this.handleServerAdded);
        ServerManager.on(SERVER_REMOVED, this.handleServerRemoved);
        ServerManager.on(SERVER_URL_CHANGED, this.handleServerUrlChanged);
        ServerManager.on(SERVER_NAME_CHANGED, this.handleServerNameChanged);
        ServerManager.on(SERVER_SWITCHED, this.handleServerSwitched);
        ServerManager.on(SERVER_LOGGED_IN_CHANGED, this.handleServerLoggedInChanged);

        ViewManager.on(VIEW_CREATED, this.sendViewLimitUpdated);
        ViewManager.on(VIEW_REMOVED, this.sendViewLimitUpdated);

        AppState.on(UPDATE_APPSTATE_FOR_VIEW_ID, this.handleUpdateAppStateForViewId);
        AppState.on(UPDATE_APPSTATE_FOR_SERVER_ID, this.handleUpdateAppStateForServerId);
    }

    init = () => {
        // Can't call this before the app is ready
        this.savedWindowState = this.getSavedWindowState();

        const windowOptions: BrowserWindowConstructorOptions = Object.assign({}, this.savedWindowState, {
            title: app.name,
            fullscreen: this.shouldStartFullScreen(),
        });
        log.debug('main window options', windowOptions);

        this.win = new BaseWindow(windowOptions);
        if (!this.win) {
            throw new Error('unable to create main window');
        }

        this.win.browserWindow.webContents.once('did-finish-load', () => {
            if (!this.win) {
                return;
            }

            if (Config.hideOnStart === false) {
                this.win.browserWindow.show();
                if (this.savedWindowState?.maximized) {
                    this.win.browserWindow.maximize();
                }
            }
        });

        this.win.browserWindow.on('close', this.onClose);
        this.win.browserWindow.on('focus', this.onFocus);
        this.win.browserWindow.on('blur', this.onBlur);
        this.win.browserWindow.contentView.on('bounds-changed', this.handleBoundsChanged);
        this.win.browserWindow.webContents.on('before-input-event', this.onBeforeInputEvent);

        const localURL = 'mattermost-desktop://renderer/index.html';
        performanceMonitor.registerView('MainWindow', this.win.browserWindow.webContents);
        this.win.browserWindow.loadURL(localURL).catch(
            (reason) => {
                log.error('failed to load', reason);
            });

        this.emit(MAIN_WINDOW_CREATED);
    };

    get isReady() {
        return this.win?.isReady;
    }

    get = () => {
        return this.win?.browserWindow;
    };

    get window() {
        return this.win;
    }

    show = () => {
        if (this.win && this.isReady) {
            // There's a bug on Windows in Electron where if the window is snapped, it will unsnap when you call show()
            // See here: https://github.com/electron/electron/issues/25359
            // So to make sure we always show the window on macOS/Linux (need for workspace switching)
            // We make an exception here
            if (process.platform === 'win32') {
                if (this.win.browserWindow.isVisible()) {
                    this.win.browserWindow.focus();
                } else {
                    this.win.browserWindow.show();
                }
            } else {
                log.info('showing main window');
                this.win.browserWindow.show();
            }
        } else {
            this.init();
        }
    };

    sendToRenderer = (channel: string, ...args: unknown[]) => {
        this.win?.sendToRenderer(channel, ...args);
    };

    getBounds = () => {
        return this.win?.getBounds();
    };

    private shouldStartFullScreen = () => {
        if (process.platform === 'linux') {
            return false;
        }

        if (global?.args?.fullscreen !== undefined) {
            return global.args.fullscreen;
        }

        if (Config.startInFullscreen) {
            return Config.startInFullscreen;
        }
        return this.savedWindowState?.fullscreen || false;
    };

    private getTitleBarOverlay = () => {
        return {
            color: Config.darkMode ? '#2e2e2e' : '#efefef',
            symbolColor: Config.darkMode ? '#c1c1c1' : '#474747',
            height: TAB_BAR_HEIGHT,
        };
    };

    private getSavedWindowState = (): Partial<SavedWindowState> => {
        try {
            let savedWindowState: SavedWindowState | null = JSON.parse(fs.readFileSync(boundsInfoPath, 'utf-8'));
            savedWindowState = Validator.validateBoundsInfo(savedWindowState);
            if (!savedWindowState) {
                throw new Error('Provided bounds info file does not validate, using defaults instead.');
            }
            const matchingScreen = screen.getDisplayMatching(savedWindowState);
            log.debug('closest matching screen for main window', matchingScreen);
            if (!(isInsideRectangle(matchingScreen.bounds, savedWindowState) || savedWindowState.maximized)) {
                throw new Error('Provided bounds info are outside the bounds of your screen, using defaults instead.');
            }

            // We check for the monitor's scale factor when we want to set these bounds
            // But only if it's not the primary monitor, otherwise it works fine as is
            // This is due to a long running Electron issue: https://github.com/electron/electron/issues/10862
            // This only needs to be done on Windows, it causes strange behaviour on Mac otherwise
            const scaleFactor = process.platform === 'win32' && matchingScreen.id !== screen.getPrimaryDisplay().id ? matchingScreen.scaleFactor : 1;
            return {
                ...savedWindowState,
                width: Math.floor(savedWindowState.width / scaleFactor),
                height: Math.floor(savedWindowState.height / scaleFactor),
            };
        } catch (e) {
            log.error(e);

            // Follow Electron's defaults, except for window dimensions which targets 1024x768 screen resolution.
            return {
                width: DEFAULT_WINDOW_WIDTH,
                height: DEFAULT_WINDOW_HEIGHT,
            };
        }
    };

    private saveWindowState = (file: string, window: BrowserWindow) => {
        const windowState: SavedWindowState = {
            ...window.getBounds(),
            maximized: window.isMaximized(),
            fullscreen: window.isFullScreen(),
        };
        try {
            log.debug('saving window state', windowState);
            fs.writeFileSync(file, JSON.stringify(windowState));
        } catch (e) {
        // [Linux] error happens only when the window state is changed before the config dir is created.
            log.error('failed to save window state', e);
        }
    };

    private onBeforeInputEvent = (event: Event, input: Input) => {
        // Register keyboard shortcuts
        // Add Alt+Cmd+(Right|Left) as alternative to switch between servers
        if (this.win && process.platform === 'darwin') {
            if (input.alt && input.meta) {
                if (input.key === 'ArrowRight') {
                    this.win.browserWindow.webContents.send(SELECT_NEXT_TAB);
                }
                if (input.key === 'ArrowLeft') {
                    this.win.browserWindow.webContents.send(SELECT_PREVIOUS_TAB);
                }
            }
        }
    };

    private onFocus = () => {
        // Only add shortcuts when window is in focus
        if (process.platform === 'linux') {
            // check if KDE + windows is minimized to prevent unwanted focus event
            // that was causing an error not allowing minimization (MM-60233)
            if ((!this.win || this.win.browserWindow.isMinimized()) && isKDE()) {
                return;
            }
        }

        this.emit(MAIN_WINDOW_RESIZED, this.win?.getBounds());
        this.emit(MAIN_WINDOW_FOCUSED);
    };

    private onBlur = () => {
        if (!this.win) {
            return;
        }

        this.emit(MAIN_WINDOW_RESIZED, this.win?.getBounds());

        // App should save bounds when a window is closed.
        // However, 'close' is not fired in some situations(shutdown, ctrl+c)
        // because main process is killed in such situations.
        // 'blur' event was effective in order to avoid this.
        // Ideally, app should detect that OS is shutting down.
        this.saveWindowState(boundsInfoPath, this.win.browserWindow);
    };

    private onClose = (event: Event) => {
        log.debug('onClose');

        if (!this.win) {
            return;
        }

        if (global.willAppQuit) { // when [Ctrl|Cmd]+Q
            this.saveWindowState(boundsInfoPath, this.win.browserWindow);
        } else { // Minimize or hide the window for close button.
            log.info('onClose', event);
            event.preventDefault();
            function hideWindow(window?: BrowserWindow) {
                window?.blur(); // To move focus to the next top-level window in Windows
                window?.hide();
            }
            switch (process.platform) {
            case 'win32':
            case 'linux':
                if (Config.minimizeToTray) {
                    if (Config.alwaysMinimize) {
                        hideWindow(this.win.browserWindow);
                    } else {
                        dialog.showMessageBox(this.win.browserWindow, {
                            title: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.title', 'Minimize to Tray'),
                            message: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.message', '{appName} will continue to run in the system tray. This can be disabled in Settings.', {appName: app.name}),
                            type: 'info',
                            checkboxChecked: true,
                            checkboxLabel: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.checkboxLabel', 'Don\'t show again'),
                        }).then((result: {response: number; checkboxChecked: boolean}) => {
                            Config.set('alwaysMinimize', result.checkboxChecked);
                            hideWindow(this.win?.browserWindow);
                        });
                    }
                } else if (Config.alwaysClose) {
                    app.quit();
                } else {
                    dialog.showMessageBox(this.win.browserWindow, {
                        title: localizeMessage('main.windows.mainWindow.closeApp.dialog.title', 'Close Application'),
                        message: localizeMessage('main.windows.mainWindow.closeApp.dialog.message', 'Are you sure you want to quit?'),
                        detail: localizeMessage('main.windows.mainWindow.closeApp.dialog.detail', 'You will no longer receive notifications for messages. If you want to leave {appName} running in the system tray, you can enable this in Settings.', {appName: app.name}),
                        type: 'question',
                        buttons: [
                            localizeMessage('label.yes', 'Yes'),
                            localizeMessage('label.no', 'No'),
                        ],
                        checkboxChecked: true,
                        checkboxLabel: localizeMessage('main.windows.mainWindow.closeApp.dialog.checkboxLabel', 'Don\'t ask again'),
                    }).then((result: {response: number; checkboxChecked: boolean}) => {
                        Config.set('alwaysClose', result.checkboxChecked && result.response === 0);
                        if (result.response === 0) {
                            app.quit();
                        }
                    });
                }
                break;
            case 'darwin':
                // need to leave fullscreen first, then hide the window
                if (this.win.browserWindow.isFullScreen()) {
                    this.win.browserWindow.once('leave-full-screen', () => {
                        if (this.win) {
                            hideWindow(this.win.browserWindow);
                        }
                    });
                    this.win.browserWindow.setFullScreen(false);
                } else {
                    hideWindow(this.win.browserWindow);
                }
                break;
            default:
            }
        }
    };

    private handleBoundsChanged = () => {
        this.emit(MAIN_WINDOW_RESIZED, this.win?.browserWindow.getContentBounds());
    };

    private handleExitFullScreen = () => {
        if (this.win?.browserWindow.isFullScreen()) {
            this.win.browserWindow.setFullScreen(false);
        }
    };

    /**
     * Server Manager atomic event handlers
     */
    private handleServerAdded = (serverId: string, setAsCurrentServer: boolean) => {
        this.win?.browserWindow.webContents.send(SERVER_ADDED, serverId, setAsCurrentServer);
    };

    private handleServerRemoved = (serverId: string) => {
        this.win?.browserWindow.webContents.send(SERVER_REMOVED, serverId);
    };

    private handleServerUrlChanged = (serverId: string) => {
        this.win?.browserWindow.webContents.send(SERVER_URL_CHANGED, serverId);
    };

    private handleServerNameChanged = (serverId: string) => {
        this.win?.browserWindow.webContents.send(SERVER_NAME_CHANGED, serverId);
    };

    private handleServerSwitched = (serverId: string) => {
        this.win?.browserWindow.webContents.send(SERVER_SWITCHED, serverId);
    };

    private handleServerLoggedInChanged = (serverId: string, loggedIn: boolean) => {
        this.win?.browserWindow.webContents.send(SERVER_LOGGED_IN_CHANGED, serverId, loggedIn);
    };

    /**
     * App State update handler
     */

    private handleUpdateAppStateForViewId = (viewId: string, isExpired: boolean, newMentions: number, newUnreads: boolean) => {
        this.win?.browserWindow.webContents.send(UPDATE_MENTIONS, viewId, newMentions, newUnreads, isExpired);
    };

    private handleUpdateAppStateForServerId = (serverId: string, expired: boolean, newMentions: number, newUnreads: boolean) => {
        this.win?.browserWindow.webContents.send(UPDATE_MENTIONS_FOR_SERVER, serverId, expired, newMentions, newUnreads);
    };

    private handleEmitConfiguration = () => {
        this.sendViewLimitUpdated();
        if (process.platform === 'linux') {
            this.win?.browserWindow.setTitleBarOverlay?.(this.getTitleBarOverlay());
        }
    };

    private sendViewLimitUpdated = () => {
        this.win?.browserWindow.webContents.send(VIEW_LIMIT_UPDATED);
    };

    private handleGetIsViewLimitReached = () => {
        return ViewManager.isViewLimitReached();
    };
}

const mainWindow = new MainWindow();
export default mainWindow;
