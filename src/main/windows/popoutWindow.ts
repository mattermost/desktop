// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserWindowConstructorOptions} from 'electron';
import {app, BrowserWindow, screen} from 'electron';
import {EventEmitter} from 'events';

import Config from 'common/config';
import {Logger} from 'common/log';
import {DEFAULT_WINDOW_HEIGHT, DEFAULT_WINDOW_WIDTH, MINIMUM_WINDOW_HEIGHT, MINIMUM_WINDOW_WIDTH, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {isInsideRectangle, getLocalPreload} from 'main/utils';
import type {MattermostWebContentsView} from 'main/views/MattermostWebContentsView';

import MainWindow from './mainWindow';

const log = new Logger('PopoutWindow');

export class PopoutWindow extends EventEmitter {
    private win?: BrowserWindow;
    private readonly webContentsView: MattermostWebContentsView;
    private ready: boolean;

    constructor(webContentsView: MattermostWebContentsView) {
        super();
        this.webContentsView = webContentsView;
        this.ready = false;
    }

    init = () => {
        log.info('init popout window');
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            throw new Error('Cannot create popout window, no main window present');
        }

        // Position the window relative to the main window
        const mainBounds = mainWindow.getBounds();
        const display = screen.getDisplayMatching(mainBounds);
        const defaultBounds = {
            x: mainBounds.x + 50,
            y: mainBounds.y + 50,
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
        };

        // Ensure window is within screen bounds
        if (!isInsideRectangle(display.bounds, defaultBounds)) {
            defaultBounds.x = display.bounds.x + 50;
            defaultBounds.y = display.bounds.y + 50;
        }

        const windowOptions: BrowserWindowConstructorOptions = {
            title: app.name,
            show: false,
            x: defaultBounds.x,
            y: defaultBounds.y,
            width: defaultBounds.width,
            height: defaultBounds.height,
            minWidth: MINIMUM_WINDOW_WIDTH,
            minHeight: MINIMUM_WINDOW_HEIGHT,
            frame: false,
            titleBarStyle: 'hidden' as const,
            titleBarOverlay: this.getTitleBarOverlay(),
            trafficLightPosition: {x: 12, y: 12},
            backgroundColor: '#000',
            webPreferences: {
                preload: getLocalPreload('internalAPI.js'),
                spellcheck: true,
            },
        };

        this.win = new BrowserWindow(windowOptions);
        if (!this.win) {
            throw new Error('unable to create popout window');
        }

        this.win.setMenuBarVisibility(false);

        this.win.once('ready-to-show', () => {
            if (!this.win) {
                return;
            }
            this.win.webContents.zoomLevel = 0;

            // Set the parent window before attaching the view
            this.webContentsView.setParentWindow(this.win);

            // Attach the view to the popout window first
            this.win.contentView.addChildView(this.webContentsView.getWebContentsView());

            // Then set the bounds to fill the window using actual window size
            const bounds = this.win.getBounds();
            this.webContentsView.setBounds({
                x: 0,
                y: TAB_BAR_HEIGHT,
                width: bounds.width,
                height: bounds.height - TAB_BAR_HEIGHT,
            });

            // Show the window
            this.win.show();
            this.ready = true;
        });

        this.win.on('close', this.onClose);
        this.win.on('closed', this.onClosed);
        this.win.on('focus', this.onFocus);
        this.win.on('blur', this.onBlur);
        this.win.on('resize', () => {
            if (this.win) {
                const bounds = this.win.contentView?.getBounds();
                this.webContentsView.setBounds({
                    x: 0,
                    y: TAB_BAR_HEIGHT,
                    width: bounds.width,
                    height: bounds.height - TAB_BAR_HEIGHT,
                });
            }
        });

        // Load the popout window HTML
        const localURL = `mattermost-desktop://renderer/popoutWindow.html?viewId=${this.webContentsView.id}`;
        this.win.loadURL(localURL).catch((reason) => {
            log.error('failed to load popout window', reason);
        });
    };

    get isReady() {
        return this.ready;
    }

    private getTitleBarOverlay = () => {
        return {
            color: Config.darkMode ? '#2e2e2e' : '#efefef',
            symbolColor: Config.darkMode ? '#c1c1c1' : '#474747',
            height: TAB_BAR_HEIGHT,
        };
    };

    private onClose = () => {
        // Clean up the view when the window is closed
        this.webContentsView.destroy();
    };

    private onClosed = () => {
        delete this.win;
        this.ready = false;
    };

    private onFocus = () => {
        // Focus the web contents when the window is focused
        this.webContentsView.focus();
    };

    private onBlur = () => {
        // Handle window blur
    };
}
