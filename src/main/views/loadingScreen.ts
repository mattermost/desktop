// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserView, app, ipcMain} from 'electron';

import {DARK_MODE_CHANGE, LOADING_SCREEN_ANIMATION_FINISHED, MAIN_WINDOW_RESIZED, TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication';
import {Logger} from 'common/log';

import {getLocalPreload, getLocalURLString, getWindowBoundaries} from 'main/utils';
import MainWindow from 'main/windows/mainWindow';

enum LoadingScreenState {
    VISIBLE = 1,
    FADING = 2,
    HIDDEN = 3,
}

const log = new Logger('LoadingScreen');

export class LoadingScreen {
    private view?: BrowserView;
    private state: LoadingScreenState;

    constructor() {
        this.state = LoadingScreenState.HIDDEN;

        MainWindow.on(MAIN_WINDOW_RESIZED, this.setBounds);
        ipcMain.on(LOADING_SCREEN_ANIMATION_FINISHED, this.handleAnimationFinished);
    }

    /**
     * Loading Screen
     */

    setDarkMode = (darkMode: boolean) => {
        this.view?.webContents.send(DARK_MODE_CHANGE, darkMode);
    }

    isHidden = () => {
        return this.state === LoadingScreenState.HIDDEN;
    }

    show = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
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

        if (mainWindow.getBrowserViews().includes(this.view!)) {
            mainWindow.setTopBrowserView(this.view!);
        } else {
            mainWindow.addBrowserView(this.view!);
        }

        this.setBounds();
    }

    fade = () => {
        if (this.view && this.state === LoadingScreenState.VISIBLE) {
            this.state = LoadingScreenState.FADING;
            this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
        }
    }

    private create = () => {
        const preload = getLocalPreload('internalAPI.js');
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
            MainWindow.get()?.removeBrowserView(this.view);
        }

        if (process.env.NODE_ENV === 'test') {
            app.emit('e2e-app-loaded');
        }
    }

    private setBounds = () => {
        if (this.view) {
            const mainWindow = MainWindow.get();
            if (!mainWindow) {
                return;
            }
            this.view.setBounds(getWindowBoundaries(mainWindow));
        }
    }
}

const loadingScreen = new LoadingScreen();
export default loadingScreen;
