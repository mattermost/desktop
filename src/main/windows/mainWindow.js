// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import path from 'path';
import os from 'os';

import {app, BrowserWindow} from 'electron';
import log from 'electron-log';

import {SELECT_NEXT_TAB, SELECT_PREVIOUS_TAB} from 'common/communication';

import * as Validator from '../Validator';
import contextMenu from '../contextMenu';
import {getLocalPreload, getLocalURLString} from '../utils';

function saveWindowState(file, window) {
    const windowState = window.getBounds();
    windowState.maximized = window.isMaximized();
    try {
        fs.writeFileSync(file, JSON.stringify(windowState));
    } catch (e) {
    // [Linux] error happens only when the window state is changed before the config dir is created.
        log.error(e);
    }
}

function isFramelessWindow() {
    return os.platform() === 'darwin' || (os.platform() === 'win32' && os.release().startsWith('10'));
}

function createMainWindow(config, options) {
    const defaultWindowWidth = 1000;
    const defaultWindowHeight = 700;
    const minimumWindowWidth = 400;
    const minimumWindowHeight = 240;

    // Create the browser window.
    const preload = getLocalPreload('mainWindow.js');
    const boundsInfoPath = path.join(app.getPath('userData'), 'bounds-info.json');
    let windowOptions;
    try {
        windowOptions = JSON.parse(fs.readFileSync(boundsInfoPath, 'utf-8'));
        windowOptions = Validator.validateBoundsInfo(windowOptions);
        if (!windowOptions) {
            throw new Error('Provided bounds info file does not validate, using defaults instead.');
        }
    } catch (e) {
    // Follow Electron's defaults, except for window dimensions which targets 1024x768 screen resolution.
        windowOptions = {width: defaultWindowWidth, height: defaultWindowHeight};
    }

    const {maximized: windowIsMaximized} = windowOptions;

    const spellcheck = (typeof config.useSpellChecker === 'undefined' ? true : config.useSpellChecker);

    if (process.platform === 'linux') {
        windowOptions.icon = options.linuxAppIcon;
    }
    Object.assign(windowOptions, {
        title: app.name,
        fullscreenable: true,
        show: false, // don't start the window until it is ready and only if it isn't hidden
        paintWhenInitiallyHidden: true, // we want it to start painting to get info from the webapp
        minWidth: minimumWindowWidth,
        minHeight: minimumWindowHeight,
        frame: !isFramelessWindow(),
        fullscreen: false,
        titleBarStyle: 'hidden',
        trafficLightPosition: {x: 12, y: 24},
        backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
        webPreferences: {
            nodeIntegration: process.env.NODE_ENV === 'test',
            contextIsolation: process.env.NODE_ENV !== 'test',
            disableBlinkFeatures: 'Auxclick',
            preload,
            spellcheck,
            enableRemoteModule: process.env.NODE_ENV === 'test',
        },
    });

    const mainWindow = new BrowserWindow(windowOptions);
    mainWindow.setMenuBarVisibility(false);

    const localURL = getLocalURLString('index.html');
    mainWindow.loadURL(localURL).catch(
        (reason) => {
            log.error(`Main window failed to load: ${reason}`);
        });
    mainWindow.once('ready-to-show', () => {
        mainWindow.webContents.zoomLevel = 0;

        mainWindow.show();
        if (windowIsMaximized) {
            mainWindow.maximize();
        }
    });

    mainWindow.once('show', () => {
        mainWindow.show();
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
        if (global.willAppQuit) { // when [Ctrl|Cmd]+Q
            saveWindowState(boundsInfoPath, mainWindow);
        } else { // Minimize or hide the window for close button.
            event.preventDefault();
            function hideWindow(window) {
                window.blur(); // To move focus to the next top-level window in Windows
                window.hide();
            }
            switch (process.platform) {
            case 'win32':
                hideWindow(mainWindow);
                break;
            case 'linux':
                if (config.minimizeToTray) {
                    hideWindow(mainWindow);
                } else {
                    mainWindow.minimize();
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

    contextMenu.setup({useSpellChecker: config.useSpellChecker});
    return mainWindow;
}

export default createMainWindow;
