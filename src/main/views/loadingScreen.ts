// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, BrowserWindow, app, ipcMain} from 'electron';
import log from 'electron-log';

import {DARK_MODE_CHANGE, LOADING_SCREEN_ANIMATION_FINISHED, TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication';

import {getLocalPreload, getLocalURLString, getWindowBoundaries} from 'main/utils';

enum LoadingScreenState {
    VISIBLE = 1,
    FADING = 2,
    HIDDEN = 3,
}

export class LoadingScreen {
    private view?: BrowserView;
    private state: LoadingScreenState;
    private mainWindow?: BrowserWindow;

    constructor() {
        this.state = LoadingScreenState.HIDDEN;

        ipcMain.on(LOADING_SCREEN_ANIMATION_FINISHED, this.handleAnimationFinished);
    }

    /**
     * Loading Screen
     */

    setBounds = () => {
        if (!(this.view && this.mainWindow)) {
            return;
        }

        this.view.setBounds(getWindowBoundaries(this.mainWindow));
    }

    setDarkMode = (darkMode: boolean) => {
        this.view?.webContents.send(DARK_MODE_CHANGE, darkMode);
    }

    isHidden = () => {
        return this.state === LoadingScreenState.HIDDEN;
    }

    show = () => {
        if (!this.mainWindow) {
            return;
        }

        if (!this.view) {
            this.create();
        }

        this.state = LoadingScreenState.VISIBLE;

        if (this.view?.webContents.isLoading()) {
            this.view.webContents.once('did-finish-load', () => {
                this.view!.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            });
        } else {
            this.view!.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
        }

        if (this.mainWindow.getBrowserViews().includes(this.view!)) {
            this.mainWindow.setTopBrowserView(this.view!);
        } else {
            this.mainWindow.addBrowserView(this.view!);
        }

        this.setBounds();
    }

    fade = () => {
        if (this.view && this.state === LoadingScreenState.VISIBLE) {
            this.state = LoadingScreenState.FADING;
            this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
        }
    }

    setMainWindow = (mainWindow: BrowserWindow) => {
        this.mainWindow = mainWindow;
    }

    private create = () => {
        const preload = getLocalPreload('desktopAPI.js');
        this.view = new BrowserView({webPreferences: {
            preload,

            // Workaround for this issue: https://github.com/electron/electron/issues/30993
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            transparent: true,
        }});
        const localURL = getLocalURLString('loadingScreen.html');
        this.view.webContents.loadURL(localURL);
    }

    private handleAnimationFinished = () => {
        log.debug('handleLoadingScreenAnimationFinished');

        if (this.view && this.state !== LoadingScreenState.HIDDEN) {
            this.state = LoadingScreenState.HIDDEN;
            this.mainWindow?.removeBrowserView(this.view);
        }

        if (process.env.NODE_ENV === 'test') {
            app.emit('e2e-app-loaded');
        }
    }
}

const loadingScreen = new LoadingScreen();
export default loadingScreen;
