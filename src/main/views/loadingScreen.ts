// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebContentsView, app, ipcMain} from 'electron';

import {DARK_MODE_CHANGE, LOADING_SCREEN_ANIMATION_FINISHED, MAIN_WINDOW_RESIZED, TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication';
import {Logger} from 'common/log';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload, getWindowBoundaries} from 'main/utils';
import MainWindow from 'main/windows/mainWindow';

enum LoadingScreenState {
    VISIBLE = 1,
    FADING = 2,
    HIDDEN = 3,
}

const log = new Logger('LoadingScreen');

export class LoadingScreen {
    private view?: WebContentsView;
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
    };

    isHidden = () => {
        return this.state === LoadingScreenState.HIDDEN;
    };

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
                mainWindow.contentView.addChildView(this.view!);
            });
        } else {
            this.view!.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            mainWindow.contentView.addChildView(this.view!);
        }

        this.setBounds();
    };

    fade = () => {
        if (this.view && this.state === LoadingScreenState.VISIBLE) {
            this.state = LoadingScreenState.FADING;
            this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
        }
    };

    private create = () => {
        this.view = new WebContentsView({
            webPreferences: {
                preload: getLocalPreload('internalAPI.js'),

                // For some reason this is required to make the background transparent
                // for the loading screen, even though the docs say it's the default.
                // See: https://www.electronjs.org/docs/latest/api/structures/web-preferences
                transparent: true,
            }},
        );
        performanceMonitor.registerView('LoadingScreen', this.view.webContents);
        this.view.webContents.loadURL('mattermost-desktop://renderer/loadingScreen.html');
    };

    private handleAnimationFinished = () => {
        log.debug('handleLoadingScreenAnimationFinished');

        if (this.view && this.state !== LoadingScreenState.HIDDEN) {
            this.state = LoadingScreenState.HIDDEN;
            MainWindow.get()?.contentView.removeChildView(this.view);
            this.view.webContents.close();
            delete this.view;
        }

        if (process.env.NODE_ENV === 'test') {
            app.emit('e2e-app-loaded');
            MainWindow.get()?.focus();
        }
    };

    private setBounds = () => {
        if (this.view) {
            const mainWindow = MainWindow.get();
            if (!mainWindow) {
                return;
            }
            this.view.setBounds(getWindowBoundaries(mainWindow));
        }
    };
}

const loadingScreen = new LoadingScreen();
export default loadingScreen;
