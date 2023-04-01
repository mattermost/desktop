// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import path from 'path';

import os from 'os';

import {app, BrowserWindow, BrowserWindowConstructorOptions, dialog, Event, globalShortcut, Input, ipcMain, screen} from 'electron';
import log from 'electron-log';

import {SavedWindowState} from 'types/mainWindow';

import {SELECT_NEXT_TAB, SELECT_PREVIOUS_TAB, GET_FULL_SCREEN_STATUS, FOCUS_THREE_DOT_MENU} from 'common/communication';
import Config from 'common/config';
import {DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MINIMUM_WINDOW_HEIGHT, MINIMUM_WINDOW_WIDTH} from 'common/utils/constants';
import Utils from 'common/utils/util';

import {boundsInfoPath} from 'main/constants';
import CriticalErrorHandler from 'main/CriticalErrorHandler';
import {localizeMessage} from 'main/i18nManager';

import * as Validator from '../Validator';
import ContextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString, isInsideRectangle} from '../utils';

export class MainWindow {
    private win?: BrowserWindow;

    private savedWindowState: SavedWindowState;
    private ready: boolean;

    constructor() {
        // Create the browser window.
        this.ready = false;
        this.savedWindowState = this.getSavedWindowState();

        ipcMain.handle(GET_FULL_SCREEN_STATUS, () => this.win?.isFullScreen());
    }

    init = () => {
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
        this.win.setMenuBarVisibility(false);

        if (!this.win) {
            log.error('unable to create main window');
            app.quit();
            return;
        }

        const localURL = getLocalURLString('index.html');
        this.win.loadURL(localURL).catch(
            (reason) => {
                log.error('failed to load', reason);
            });
        this.win.once('ready-to-show', () => {
            if (!this.win) {
                return;
            }
            this.win.webContents.zoomLevel = 0;

            if (Config.hideOnStart === false) {
                this.win.show();
                if (this.savedWindowState.maximized) {
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

        this.win.webContents.on('before-input-event', this.onBeforeInputEvent);

        // Should not allow the main window to generate a window of its own
        this.win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
        if (process.env.MM_DEBUG_SETTINGS) {
            this.win.webContents.openDevTools({mode: 'detach'});
        }

        const contextMenu = new ContextMenu({}, this.win);
        contextMenu.reload();
    }

    get isReady() {
        return this.ready;
    }

    get = (ensureCreated?: boolean) => {
        if (ensureCreated && !this.win) {
            this.init();
        }
        return this.win;
    }

    getBounds = () => {
        return this.win?.getContentBounds();
    }

    focusThreeDotMenu = () => {
        if (this.win) {
            this.win.webContents.focus();
            this.win.webContents.send(FOCUS_THREE_DOT_MENU);
        }
    }

    private shouldStartFullScreen = () => {
        if (global?.args?.fullscreen !== undefined) {
            return global.args.fullscreen;
        }

        if (Config.startInFullscreen) {
            return Config.startInFullscreen;
        }
        return this.savedWindowState.fullscreen || false;
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
            globalShortcut.registerAll(['Alt+F', 'Alt+E', 'Alt+V', 'Alt+H', 'Alt+W', 'Alt+P'], () => {
                // do nothing because we want to supress the menu popping up
            });
        }
    }

    private onBlur = () => {
        if (!this.win) {
            return;
        }

        globalShortcut.unregisterAll();

        // App should save bounds when a window is closed.
        // However, 'close' is not fired in some situations(shutdown, ctrl+c)
        // because main process is killed in such situations.
        // 'blur' event was effective in order to avoid this.
        // Ideally, app should detect that OS is shutting down.
        this.saveWindowState(boundsInfoPath, this.win);
    }

    private onClose = (event: Event) => {
        log.debug('MainWindow.on.close');

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
        CriticalErrorHandler.setMainWindow(this.win!);
        CriticalErrorHandler.windowUnresponsiveHandler();
    }
}

const mainWindow = new MainWindow();
export default mainWindow;
