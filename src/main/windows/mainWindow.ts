// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import path from 'path';

import os from 'os';

import {EventEmitter} from 'events';

import {app, BrowserWindow, BrowserWindowConstructorOptions, dialog, Event, globalShortcut, Input, ipcMain, screen} from 'electron';

import {SavedWindowState} from 'types/mainWindow';

import AppState from 'common/appState';
import {
    SELECT_NEXT_TAB,
    SELECT_PREVIOUS_TAB,
    GET_FULL_SCREEN_STATUS,
    FOCUS_THREE_DOT_MENU,
    SERVERS_UPDATE,
    UPDATE_APPSTATE_FOR_VIEW_ID,
    UPDATE_MENTIONS,
    MAXIMIZE_CHANGE,
    MAIN_WINDOW_CREATED,
    MAIN_WINDOW_RESIZED,
    MAIN_WINDOW_FOCUSED,
    VIEW_FINISHED_RESIZING,
    TOGGLE_SECURE_INPUT,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MINIMUM_WINDOW_HEIGHT, MINIMUM_WINDOW_WIDTH, SECOND} from 'common/utils/constants';
import Utils from 'common/utils/util';
import * as Validator from 'common/Validator';

import {boundsInfoPath} from 'main/constants';
import {localizeMessage} from 'main/i18nManager';

import ContextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString, isInsideRectangle} from '../utils';

const log = new Logger('MainWindow');
const ALT_MENU_KEYS = ['Alt+F', 'Alt+E', 'Alt+V', 'Alt+H', 'Alt+W', 'Alt+P'];

export class MainWindow extends EventEmitter {
    private win?: BrowserWindow;

    private savedWindowState?: SavedWindowState;
    private ready: boolean;
    private isResizing: boolean;
    private lastEmittedBounds?: Electron.Rectangle

    constructor() {
        super();

        // Create the browser window.
        this.ready = false;
        this.isResizing = false;

        ipcMain.handle(GET_FULL_SCREEN_STATUS, () => this.win?.isFullScreen());
        ipcMain.on(VIEW_FINISHED_RESIZING, this.handleViewFinishedResizing);

        ServerManager.on(SERVERS_UPDATE, this.handleUpdateConfig);

        AppState.on(UPDATE_APPSTATE_FOR_VIEW_ID, this.handleUpdateAppStateForViewId);
    }

    init = () => {
        // Can't call this before the app is ready
        this.savedWindowState = this.getSavedWindowState();

        const windowOptions: BrowserWindowConstructorOptions = Object.assign({}, this.savedWindowState, {
            title: app.name,
            fullscreenable: true,
            show: false, // don't start the window until it is ready and only if it isn't hidden
            paintWhenInitiallyHidden: true, // we want it to start painting to get info from the webapp
            minWidth: MINIMUM_WINDOW_WIDTH,
            minHeight: MINIMUM_WINDOW_HEIGHT,
            frame: !this.isFramelessWindow(),
            fullscreen: this.shouldStartFullScreen(),
            titleBarStyle: 'hidden' as const,
            trafficLightPosition: {x: 12, y: 12},
            backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
            webPreferences: {
                disableBlinkFeatures: 'Auxclick',
                preload: getLocalPreload('desktopAPI.js'),
                spellcheck: typeof Config.useSpellChecker === 'undefined' ? true : Config.useSpellChecker,
            },
        });

        if (process.platform === 'linux') {
            windowOptions.icon = path.join(path.resolve(app.getAppPath(), 'assets'), 'linux', 'app_icon.png');
        }

        this.win = new BrowserWindow(windowOptions);
        if (!this.win) {
            throw new Error('unable to create main window');
        }

        this.win.setMenuBarVisibility(false);

        this.win.once('ready-to-show', () => {
            if (!this.win) {
                return;
            }
            this.win.webContents.zoomLevel = 0;

            if (Config.hideOnStart === false) {
                this.win.show();
                if (this.savedWindowState?.maximized) {
                    this.win.maximize();
                }
            }

            this.ready = true;
        });

        this.win.once('restore', () => {
            this.win?.restore();
        });
        this.win.on('close', this.onClose);
        this.win.on('closed', this.onClosed);
        this.win.on('focus', this.onFocus);
        this.win.on('blur', this.onBlur);
        this.win.on('unresponsive', this.onUnresponsive);
        this.win.on('maximize', this.onMaximize);
        this.win.on('unmaximize', this.onUnmaximize);
        this.win.on('enter-full-screen', this.onEnterFullScreen);
        this.win.on('leave-full-screen', this.onLeaveFullScreen);
        this.win.on('will-resize', this.onWillResize);
        this.win.on('resized', this.onResized);
        if (process.platform === 'win32') {
            // We don't want this on macOS, it's an alias of 'move'
            // This is mostly a fix for Windows 11 snapping
            this.win.on('moved', this.onResized);
        }
        if (process.platform === 'linux') {
            this.win.on('resize', this.onResize);
        }
        this.win.webContents.on('before-input-event', this.onBeforeInputEvent);

        // Should not allow the main window to generate a window of its own
        this.win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
        if (process.env.MM_DEBUG_SETTINGS) {
            this.win.webContents.openDevTools({mode: 'detach'});
        }

        const contextMenu = new ContextMenu({}, this.win);
        contextMenu.reload();

        const localURL = getLocalURLString('index.html');
        this.win.loadURL(localURL).catch(
            (reason) => {
                log.error('failed to load', reason);
            });

        this.emit(MAIN_WINDOW_CREATED);
    }

    get isReady() {
        return this.ready;
    }

    get = () => {
        return this.win;
    }

    show = () => {
        if (this.win && this.isReady) {
            // There's a bug on Windows in Electron where if the window is snapped, it will unsnap when you call show()
            // See here: https://github.com/electron/electron/issues/25359
            // So to make sure we always show the window on macOS/Linux (need for workspace switching)
            // We make an exception here
            if (process.platform === 'win32') {
                if (this.win.isVisible()) {
                    this.win.focus();
                } else {
                    this.win.show();
                }
            } else {
                this.win.show();
            }
        } else {
            this.init();
        }
    }

    getBounds = (): Electron.Rectangle | undefined => {
        if (!this.win) {
            return undefined;
        }

        // Workaround for linux maximizing/minimizing, which doesn't work properly because of these bugs:
        // https://github.com/electron/electron/issues/28699
        // https://github.com/electron/electron/issues/28106
        if (process.platform === 'linux') {
            const size = this.win.getSize();
            return {...this.win.getContentBounds(), width: size[0], height: size[1]};
        }

        return this.win.getContentBounds();
    }

    focusThreeDotMenu = () => {
        if (this.win) {
            this.win.webContents.focus();
            this.win.webContents.send(FOCUS_THREE_DOT_MENU);
        }
    }

    sendToRenderer = (channel: string, ...args: unknown[]) => {
        this.sendToRendererWithRetry(3, channel, ...args);
    }

    private sendToRendererWithRetry = (maxRetries: number, channel: string, ...args: unknown[]) => {
        if (!this.win || !this.isReady) {
            if (maxRetries > 0) {
                log.debug(`Can't send ${channel}, will retry`);
                setTimeout(() => {
                    this.sendToRendererWithRetry(maxRetries - 1, channel, ...args);
                }, SECOND);
            } else {
                log.error(`Unable to send the message to the main window for message type ${channel}`);
            }
            return;
        }
        this.win.webContents.send(channel, ...args);
    }

    private shouldStartFullScreen = () => {
        if (global?.args?.fullscreen !== undefined) {
            return global.args.fullscreen;
        }

        if (Config.startInFullscreen) {
            return Config.startInFullscreen;
        }
        return this.savedWindowState?.fullscreen || false;
    }

    private isFramelessWindow = () => {
        return os.platform() === 'darwin' || (os.platform() === 'win32' && Utils.isVersionGreaterThanOrEqualTo(os.release(), '6.2'));
    }

    private getSavedWindowState = () => {
        let savedWindowState: any;
        try {
            savedWindowState = JSON.parse(fs.readFileSync(boundsInfoPath, 'utf-8'));
            savedWindowState = Validator.validateBoundsInfo(savedWindowState);
            if (!savedWindowState) {
                throw new Error('Provided bounds info file does not validate, using defaults instead.');
            }
            const matchingScreen = screen.getDisplayMatching(savedWindowState);
            if (!(matchingScreen && (isInsideRectangle(matchingScreen.bounds, savedWindowState) || savedWindowState.maximized))) {
                throw new Error('Provided bounds info are outside the bounds of your screen, using defaults instead.');
            }
        } catch (e) {
            log.error(e);

            // Follow Electron's defaults, except for window dimensions which targets 1024x768 screen resolution.
            savedWindowState = {width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT};
        }
        return savedWindowState;
    }

    private saveWindowState = (file: string, window: BrowserWindow) => {
        const windowState: SavedWindowState = {
            ...window.getBounds(),
            maximized: window.isMaximized(),
            fullscreen: window.isFullScreen(),
        };
        try {
            fs.writeFileSync(file, JSON.stringify(windowState));
        } catch (e) {
        // [Linux] error happens only when the window state is changed before the config dir is created.
            log.error('failed to save window state', e);
        }
    }

    private onBeforeInputEvent = (event: Event, input: Input) => {
        // Register keyboard shortcuts
        // Add Alt+Cmd+(Right|Left) as alternative to switch between servers
        if (this.win && process.platform === 'darwin') {
            if (input.alt && input.meta) {
                if (input.key === 'ArrowRight') {
                    this.win.webContents.send(SELECT_NEXT_TAB);
                }
                if (input.key === 'ArrowLeft') {
                    this.win.webContents.send(SELECT_PREVIOUS_TAB);
                }
            }
        }
    }

    private onFocus = () => {
        // Only add shortcuts when window is in focus
        if (process.platform === 'linux') {
            globalShortcut.registerAll(ALT_MENU_KEYS, () => {
                // do nothing because we want to supress the menu popping up
            });
        }

        this.emit(MAIN_WINDOW_RESIZED, this.getBounds());
        this.emit(MAIN_WINDOW_FOCUSED);
    }

    private onBlur = () => {
        if (!this.win) {
            return;
        }

        globalShortcut.unregisterAll();

        this.emit(MAIN_WINDOW_RESIZED, this.getBounds());
        ipcMain.emit(TOGGLE_SECURE_INPUT, null, false);

        // App should save bounds when a window is closed.
        // However, 'close' is not fired in some situations(shutdown, ctrl+c)
        // because main process is killed in such situations.
        // 'blur' event was effective in order to avoid this.
        // Ideally, app should detect that OS is shutting down.
        this.saveWindowState(boundsInfoPath, this.win);
    }

    private onClose = (event: Event) => {
        log.debug('onClose');

        if (!this.win) {
            return;
        }

        if (global.willAppQuit) { // when [Ctrl|Cmd]+Q
            this.saveWindowState(boundsInfoPath, this.win);
        } else { // Minimize or hide the window for close button.
            event.preventDefault();
            function hideWindow(window: BrowserWindow) {
                window.blur(); // To move focus to the next top-level window in Windows
                window.hide();
            }
            switch (process.platform) {
            case 'win32':
            case 'linux':
                if (Config.minimizeToTray) {
                    if (Config.alwaysMinimize) {
                        hideWindow(this.win);
                    } else {
                        dialog.showMessageBox(this.win, {
                            title: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.title', 'Minimize to Tray'),
                            message: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.message', '{appName} will continue to run in the system tray. This can be disabled in Settings.', {appName: app.name}),
                            type: 'info',
                            checkboxChecked: true,
                            checkboxLabel: localizeMessage('main.windows.mainWindow.minimizeToTray.dialog.checkboxLabel', 'Don\'t show again'),
                        }).then((result: {response: number; checkboxChecked: boolean}) => {
                            Config.set('alwaysMinimize', result.checkboxChecked);
                            hideWindow(this.win!);
                        });
                    }
                } else if (Config.alwaysClose) {
                    app.quit();
                } else {
                    dialog.showMessageBox(this.win, {
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
                if (this.win.isFullScreen()) {
                    this.win.once('leave-full-screen', () => {
                        app.hide();
                    });
                    this.win.setFullScreen(false);
                } else {
                    app.hide();
                }
                break;
            default:
            }
        }
    }

    private onClosed = () => {
        log.verbose('main window closed');
        delete this.win;
        this.ready = false;
    }

    private onUnresponsive = () => {
        if (!this.win) {
            throw new Error('BrowserWindow \'unresponsive\' event has been emitted');
        }
        dialog.showMessageBox(this.win, {
            type: 'warning',
            title: app.name,
            message: localizeMessage('main.CriticalErrorHandler.unresponsive.dialog.message', 'The window is no longer responsive.\nDo you wait until the window becomes responsive again?'),
            buttons: [
                localizeMessage('label.no', 'No'),
                localizeMessage('label.yes', 'Yes'),
            ],
            defaultId: 0,
        }).then(({response}) => {
            if (response === 0) {
                log.error('BrowserWindow \'unresponsive\' event has been emitted');
                app.relaunch();
            }
        });
    }

    private emitBounds = (bounds?: Electron.Rectangle, force?: boolean) => {
        // Workaround since the window bounds aren't updated immediately when the window is maximized for some reason
        // We also don't want to force too many resizes so we throttle here
        setTimeout(() => {
            const newBounds = bounds ?? this.getBounds();
            if (!force && newBounds?.height === this.lastEmittedBounds?.height && newBounds?.width === this.lastEmittedBounds?.width) {
                return;
            }

            // For some reason on Linux I've seen the menu bar popup again
            this.win?.setMenuBarVisibility(false);

            this.emit(MAIN_WINDOW_RESIZED, newBounds);
            this.lastEmittedBounds = newBounds;
        }, 10);
    }

    private onMaximize = () => {
        this.win?.webContents.send(MAXIMIZE_CHANGE, true);
        this.emitBounds();
    }

    private onUnmaximize = () => {
        this.win?.webContents.send(MAXIMIZE_CHANGE, false);
        this.emitBounds();
    }

    private onEnterFullScreen = () => {
        this.win?.webContents.send('enter-full-screen');
        this.emitBounds();
    }

    private onLeaveFullScreen = () => {
        this.win?.webContents.send('leave-full-screen');
        this.emitBounds();
    }

    /**
     * Resizing code
     */

    private onWillResize = (event: Event, newBounds: Electron.Rectangle) => {
        log.silly('onWillResize', newBounds);

        /**
         * Fixes an issue on win11 related to Snap where the first "will-resize" event would return the same bounds
         * causing the "resize" event to not fire
         */
        const prevBounds = this.getBounds();
        if (prevBounds?.height === newBounds.height && prevBounds?.width === newBounds.width) {
            log.debug('prevented resize');
            event.preventDefault();
            return;
        }

        // Workaround for macOS to stop the window from sending too many resize calls to the BrowserViews
        if (process.platform === 'darwin' && this.isResizing) {
            log.debug('prevented resize');
            event.preventDefault();
            return;
        }

        this.isResizing = true;
        this.emitBounds(newBounds);
    }

    private onResize = () => {
        log.silly('onResize');

        // Workaround for macOS to stop the window from sending too many resize calls to the BrowserViews
        if (process.platform === 'darwin' && this.isResizing) {
            return;
        }
        this.emitBounds();
    }

    private onResized = () => {
        log.debug('onResized');

        // Because this is the final window state after a resize, we force the size here
        this.emitBounds(this.getBounds(), true);
        this.isResizing = false;
    }

    private handleViewFinishedResizing = () => {
        this.isResizing = false;
    }

    /**
     * Server Manager update handler
     */
    private handleUpdateConfig = () => {
        this.win?.webContents.send(SERVERS_UPDATE);
    }

    /**
     * App State update handler
     */

    private handleUpdateAppStateForViewId = (viewId: string, isExpired: boolean, newMentions: number, newUnreads: boolean) => {
        this.win?.webContents.send(UPDATE_MENTIONS, viewId, newMentions, newUnreads, isExpired);
    }
}

const mainWindow = new MainWindow();
export default mainWindow;
