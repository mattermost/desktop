// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import path from 'path';

import type {BrowserWindowConstructorOptions, Input} from 'electron';
import {app, BrowserWindow, dialog, globalShortcut, ipcMain} from 'electron';

import {LoadingScreen} from 'app/views/loadingScreen';
import {URLView} from 'app/views/urlView';
import {
    DARK_MODE_CHANGE,
    EMIT_CONFIGURATION,
    FOCUS_THREE_DOT_MENU,
    RELOAD_CONFIGURATION,
    TOGGLE_SECURE_INPUT,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import {DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MINIMUM_WINDOW_HEIGHT, MINIMUM_WINDOW_WIDTH, SECOND, TAB_BAR_HEIGHT} from 'common/utils/constants';
import Utils from 'common/utils/util';
import {localizeMessage} from 'main/i18nManager';

import ContextMenu from '../../main/contextMenu';
import {getLocalPreload} from '../../main/utils';

const log = new Logger('BaseWindow');
const ALT_MENU_KEYS = ['Alt+F', 'Alt+E', 'Alt+V', 'Alt+H', 'Alt+W', 'Alt+P'];

export default class BaseWindow {
    private win: BrowserWindow;
    private loadingScreen: LoadingScreen;
    private urlView: URLView;
    private ready: boolean;

    private altPressStatus: boolean;

    constructor(options: BrowserWindowConstructorOptions) {
        this.ready = false;
        this.altPressStatus = false;

        const windowOptions: BrowserWindowConstructorOptions = Object.assign({}, {
            fullscreenable: process.platform !== 'linux',
            show: false, // don't start the window until it is ready and only if it isn't hidden
            paintWhenInitiallyHidden: true, // we want it to start painting to get info from the webapp
            minWidth: MINIMUM_WINDOW_WIDTH,
            minHeight: MINIMUM_WINDOW_HEIGHT,
            height: DEFAULT_WINDOW_HEIGHT,
            width: DEFAULT_WINDOW_WIDTH,
            frame: !this.isFramelessWindow(),
            titleBarStyle: 'hidden' as const,
            titleBarOverlay: this.getTitleBarOverlay(),
            trafficLightPosition: {x: 12, y: 12},
            backgroundColor: '#000', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
            webPreferences: {
                disableBlinkFeatures: 'Auxclick',
                preload: getLocalPreload('internalAPI.js'),
                spellcheck: typeof Config.useSpellChecker === 'undefined' ? true : Config.useSpellChecker,
            },
        }, options);
        log.debug('main window options', {windowOptions});

        if (process.platform === 'linux') {
            windowOptions.icon = path.join(path.resolve(app.getAppPath(), 'assets'), 'linux', 'app_icon.png');
        }

        this.win = new BrowserWindow(windowOptions);
        if (!this.win) {
            throw new Error('unable to create main window');
        }

        this.win.setMenuBarVisibility(false);

        this.win.webContents.once('did-finish-load', () => {
            this.win.webContents.zoomLevel = 0;
            this.ready = true;
        });

        this.win.once('restore', () => {
            this.win?.restore();
        });
        this.win.on('closed', this.onClosed);
        this.win.on('focus', this.onFocus);
        this.win.on('blur', this.onBlur);
        this.win.on('unresponsive', this.onUnresponsive);
        this.win.on('enter-full-screen', this.onEnterFullScreen);
        this.win.on('leave-full-screen', this.onLeaveFullScreen);

        // Should not allow the main window to generate a window of its own
        this.win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
        if (process.env.MM_DEBUG_SETTINGS) {
            this.win.webContents.openDevTools({mode: 'detach'});
        }

        const contextMenu = new ContextMenu({}, this.win);
        contextMenu.reload();

        this.loadingScreen = new LoadingScreen(this.win);
        this.urlView = new URLView(this.win);

        ipcMain.on(EMIT_CONFIGURATION, this.onEmitConfiguration);
    }

    get isReady() {
        return this.ready;
    }

    get browserWindow() {
        return this.win;
    }

    getBounds = (): Electron.Rectangle => {
        // Workaround for linux maximizing/minimizing, which doesn't work properly because of these bugs:
        // https://github.com/electron/electron/issues/28699
        // https://github.com/electron/electron/issues/28106
        if (process.platform === 'linux') {
            const size = this.win.getSize();
            return {...this.win.getContentBounds(), width: size[0], height: size[1]};
        }

        return this.win.getContentBounds();
    };

    handleAltKeyPressed = (_: Event, input: Input) => {
        log.silly('handleInputEvents', {input});

        if (input.type === 'keyDown') {
            this.altPressStatus = input.key === 'Alt' &&
                input.alt === true &&
                input.control === false &&
                input.shift === false &&
                input.meta === false;
        }

        if (input.key !== 'Alt') {
            this.altPressStatus = false;
        }

        if (input.type === 'keyUp' && this.altPressStatus === true) {
            this.focusThreeDotMenu();
        }
    };

    focusThreeDotMenu = () => {
        if (this.win) {
            this.win.webContents.focus();
            this.win.webContents.send(FOCUS_THREE_DOT_MENU);
        }
    };

    sendToRenderer = (channel: string, ...args: unknown[]) => {
        this.sendToRendererWithRetry(3, channel, ...args);
    };

    showLoadingScreen = (condition?: () => boolean) => {
        this.loadingScreen.show(condition);
    };

    fadeLoadingScreen = () => {
        this.loadingScreen.fade();
    };

    showURLView = (url: string) => {
        this.urlView.show(url);
    };

    private sendToRendererWithRetry = (maxRetries: number, channel: string, ...args: unknown[]) => {
        if (!this.win || !this.ready) {
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
    };

    private isFramelessWindow = () => {
        return os.platform() === 'darwin' || (os.platform() === 'win32' && Utils.isVersionGreaterThanOrEqualTo(os.release(), '6.2'));
    };

    private getTitleBarOverlay = () => {
        return {
            color: Config.darkMode ? 'rgba(25, 27, 31, 0)' : 'rgba(255, 255, 255, 0)',
            symbolColor: Config.darkMode ? '#e3e4e8' : '#3f4350',
            height: TAB_BAR_HEIGHT,
        };
    };

    private onFocus = () => {
        // Only add shortcuts when window is in focus
        if (process.platform === 'linux') {
            globalShortcut.registerAll(ALT_MENU_KEYS, () => {
                // do nothing because we want to supress the menu popping up
            });
        }
    };

    private onBlur = () => {
        globalShortcut.unregisterAll();
        ipcMain.emit(TOGGLE_SECURE_INPUT, null, false);
    };

    private onClosed = () => {
        log.info('window closed');
        this.ready = false;
        ipcMain.off(EMIT_CONFIGURATION, this.onEmitConfiguration);
        this.loadingScreen.destroy();
        this.urlView.destroy();
    };

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
    };

    private onEnterFullScreen = () => {
        this.win?.webContents.send('enter-full-screen');
    };

    private onLeaveFullScreen = () => {
        this.win?.webContents.send('leave-full-screen');
    };

    private onEmitConfiguration = () => {
        this.win.webContents.send(RELOAD_CONFIGURATION);
        this.win.webContents.send(DARK_MODE_CHANGE, Config.darkMode);
        this.win.setTitleBarOverlay(this.getTitleBarOverlay());
    };
}
