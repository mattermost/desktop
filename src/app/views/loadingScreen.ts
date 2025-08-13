// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type IpcMainEvent, type BrowserWindow, WebContentsView, app, ipcMain} from 'electron';

import {DARK_MODE_CHANGE, EMIT_CONFIGURATION, LOADING_SCREEN_ANIMATION_FINISHED, TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication';
import {Logger} from 'common/log';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload, getWindowBoundaries} from 'main/utils';

enum LoadingScreenState {
    VISIBLE = 1,
    FADING = 2,
    HIDDEN = 3,
}

const log = new Logger('LoadingScreen');

export class LoadingScreen {
    private view: WebContentsView;
    private state: LoadingScreenState;
    private parent: BrowserWindow;

    constructor(parent: BrowserWindow) {
        this.state = LoadingScreenState.HIDDEN;
        this.parent = parent;

        this.view = new WebContentsView({
            webPreferences: {
                preload: getLocalPreload('internalAPI.js'),

                // For some reason this is required to make the background transparent
                // for the loading screen, even though the docs say it's the default.
                // See: https://www.electronjs.org/docs/latest/api/structures/web-preferences
                transparent: true,
            }},
        );
        performanceMonitor.registerView(`LoadingScreen-${parent.webContents.id}`, this.view.webContents);
        this.view.webContents.loadURL('mattermost-desktop://renderer/loadingScreen.html');

        parent.contentView.on('bounds-changed', this.setBounds);
        ipcMain.on(LOADING_SCREEN_ANIMATION_FINISHED, this.handleAnimationFinished);
        ipcMain.on(EMIT_CONFIGURATION, this.handleDarkModeChange);
    }

    /**
     * Loading Screen
     */

    show = () => {
        this.state = LoadingScreenState.VISIBLE;

        if (this.view.webContents.isLoading()) {
            this.view.webContents.once('did-finish-load', () => {
                this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
                this.parent.contentView.addChildView(this.view);
            });
        } else {
            this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            this.parent.contentView.addChildView(this.view);
        }

        this.setBounds();
    };

    fade = () => {
        if (this.state === LoadingScreenState.VISIBLE) {
            this.state = LoadingScreenState.FADING;
            this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
        }
    };

    destroy = () => {
        ipcMain.off(EMIT_CONFIGURATION, this.handleDarkModeChange);
        ipcMain.off(LOADING_SCREEN_ANIMATION_FINISHED, this.handleAnimationFinished);
        performanceMonitor.unregisterView(this.view.webContents.id);
        this.view.webContents.close();
    };

    private handleAnimationFinished = () => {
        log.debug('handleLoadingScreenAnimationFinished');

        if (this.state !== LoadingScreenState.HIDDEN) {
            this.state = LoadingScreenState.HIDDEN;
            this.parent.contentView.removeChildView(this.view);
        }

        if (process.env.NODE_ENV === 'test') {
            app.emit('e2e-app-loaded');
            this.parent.focus();
        }
    };

    private setBounds = () => {
        this.view.setBounds(getWindowBoundaries(this.parent));
    };

    private handleDarkModeChange = (event: IpcMainEvent, darkMode: boolean) => {
        this.view.webContents.send(DARK_MODE_CHANGE, darkMode);
    };
}
