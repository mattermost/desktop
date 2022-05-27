// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import os from 'os';

import {app, BrowserWindow, BrowserWindowConstructorOptions, dialog, globalShortcut, ipcMain, screen} from 'electron';
import log from 'electron-log';

import {SavedWindowState} from 'types/mainWindow';

import {SELECT_NEXT_TAB, SELECT_PREVIOUS_TAB, GET_FULL_SCREEN_STATUS} from 'common/communication';
import Config from 'common/config';
import {DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MINIMUM_WINDOW_HEIGHT, MINIMUM_WINDOW_WIDTH} from 'common/utils/constants';
import Utils from 'common/utils/util';

import {boundsInfoPath} from 'main/constants';

import * as Validator from '../Validator';
import ContextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString} from '../utils';

function saveWindowState(file: string, window: BrowserWindow) {
    const windowState: SavedWindowState = {
        ...window.getBounds(),
        maximized: window.isMaximized(),
        fullscreen: window.isFullScreen(),
    };
    try {
        fs.writeFileSync(file, JSON.stringify(windowState));
    } catch (e) {
    // [Linux] error happens only when the window state is changed before the config dir is created.
        log.error(e);
    }
}

function isInsideRectangle(container: Electron.Rectangle, rect: Electron.Rectangle) {
    return container.x <= rect.x && container.y <= rect.y && container.width >= rect.width && container.height >= rect.height;
}

function isFramelessWindow() {
    return os.platform() === 'darwin' || (os.platform() === 'win32' && Utils.isVersionGreaterThanOrEqualTo(os.release(), '6.2'));
}

function createMainWindow(options: {linuxAppIcon: string; fullscreen?: boolean}) {
    // Create the browser window.
    const preload = getLocalPreload('mainWindow.js');
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

    const {maximized: windowIsMaximized} = savedWindowState;

    const spellcheck = (typeof Config.useSpellChecker === 'undefined' ? true : Config.useSpellChecker);
    const isFullScreen = () => {
        if (global?.args?.fullscreen !== undefined) {
            return global.args.fullscreen;
        }

        if (Config.startInFullscreen) {
            return Config.startInFullscreen;
        }
        return options.fullscreen || savedWindowState.fullscreen || false;
    };

    const windowOptions: BrowserWindowConstructorOptions = Object.assign({}, savedWindowState, {
        title: app.name,
        fullscreenable: true,
        show: false, // don't start the window until it is ready and only if it isn't hidden
        paintWhenInitiallyHidden: true, // we want it to start painting to get info from the webapp
        minWidth: MINIMUM_WINDOW_WIDTH,
        minHeight: MINIMUM_WINDOW_HEIGHT,
        frame: !isFramelessWindow(),
        fullscreen: isFullScreen(),
        titleBarStyle: 'hidden' as const,
        trafficLightPosition: {x: 12, y: 12},
        backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
        webPreferences: {
            disableBlinkFeatures: 'Auxclick',
            preload,
            spellcheck,
        },
    });

    if (process.platform === 'linux') {
        windowOptions.icon = options.linuxAppIcon;
    }

    const mainWindow = new BrowserWindow(windowOptions);
    mainWindow.setMenuBarVisibility(false);

    try {
        ipcMain.handle(GET_FULL_SCREEN_STATUS, () => mainWindow.isFullScreen());
    } catch (e) {
        log.error('Tried to register second handler, skipping');
    }

    const localURL = getLocalURLString('index.html');
    mainWindow.loadURL(localURL).catch(
        (reason) => {
            log.error(`Main window failed to load: ${reason}`);
        });
    mainWindow.once('ready-to-show', () => {
        mainWindow.webContents.zoomLevel = 0;

        if (Config.hideOnStart === false) {
            mainWindow.show();
            if (windowIsMaximized) {
                mainWindow.maximize();
            }
        }
    });

    mainWindow.once('restore', () => {
        mainWindow.restore();
    });

    // App should save bounds when a window is closed.
    // However, 'close' is not fired in some situations(shutdown, ctrl+c)
    // because main process is killed in such situations.
    // 'blur' event was effective in order to avoid this.
    // Ideally, app should detect that OS is shutting down.
    mainWindow.on('blur', () => {
        saveWindowState(boundsInfoPath, mainWindow);
    });

    mainWindow.on('close', (event) => {
        log.debug('MainWindow.on.close');

        if (global.willAppQuit) { // when [Ctrl|Cmd]+Q
            saveWindowState(boundsInfoPath, mainWindow);
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
                        hideWindow(mainWindow);
                    } else {
                        dialog.showMessageBox(mainWindow, {
                            title: 'Minimize to Tray',
                            message: 'Mattermost will continue to run in the system tray. This can be disabled in Settings.',
                            type: 'info',
                            checkboxChecked: true,
                            checkboxLabel: 'Don\'t show again',
                        }).then((result: {response: number; checkboxChecked: boolean}) => {
                            Config.set('alwaysMinimize', result.checkboxChecked);
                            hideWindow(mainWindow);
                        });
                    }
                } else if (Config.alwaysClose) {
                    app.quit();
                } else {
                    dialog.showMessageBox(mainWindow, {
                        title: 'Close Application',
                        message: 'Are you sure you want to quit?',
                        detail: 'You will no longer receive notifications for messages. If you want to leave Mattermost running in the system tray, you can enable this in Settings.',
                        type: 'question',
                        buttons: ['Yes', 'No'],
                        checkboxChecked: true,
                        checkboxLabel: 'Don\'t ask again',
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
                if (mainWindow.isFullScreen()) {
                    mainWindow.once('leave-full-screen', () => {
                        app.hide();
                    });
                    mainWindow.setFullScreen(false);
                } else {
                    app.hide();
                }
                break;
            default:
            }
        }
    });

    // Register keyboard shortcuts
    mainWindow.webContents.on('before-input-event', (event, input) => {
    // Add Alt+Cmd+(Right|Left) as alternative to switch between servers
        if (process.platform === 'darwin') {
            if (input.alt && input.meta) {
                if (input.key === 'ArrowRight') {
                    mainWindow.webContents.send(SELECT_NEXT_TAB);
                }
                if (input.key === 'ArrowLeft') {
                    mainWindow.webContents.send(SELECT_PREVIOUS_TAB);
                }
            }
        }
    });

    // Only add shortcuts when window is in focus
    mainWindow.on('focus', () => {
        if (process.platform === 'linux') {
            globalShortcut.registerAll(['Alt+F', 'Alt+E', 'Alt+V', 'Alt+H', 'Alt+W', 'Alt+P'], () => {
                // do nothing because we want to supress the menu popping up
            });
        }
    });
    mainWindow.on('blur', () => {
        globalShortcut.unregisterAll();
    });

    const contextMenu = new ContextMenu({}, mainWindow);
    contextMenu.reload();

    return mainWindow;
}

export default createMainWindow;
