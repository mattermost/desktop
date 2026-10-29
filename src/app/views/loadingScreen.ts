// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type WebContents, ipcMain, type BrowserWindow, WebContentsView, app} from 'electron';

import {LOADING_SCREEN_ANIMATION_FINISHED, TOGGLE_LOADING_SCREEN_VISIBILITY} from 'common/communication';
import {Logger} from 'common/log';
import performanceMonitor from 'main/performanceMonitor';
import {getLocalPreload, getWindowBoundaries} from 'main/utils';

enum LoadingScreenState {
    VISIBLE = 1,
    FADING = 2,
    HIDDEN = 3,
}

// The renderer fade-out animation normally takes ~3 seconds at most
const FADE_FALLBACK_TIMEOUT_MS = 5000;

const log = new Logger('LoadingScreen');

export class LoadingScreen {
    private view: WebContentsView;
    private state: LoadingScreenState;
    private parent: BrowserWindow;
    private fadeFallbackTimeout?: NodeJS.Timeout;

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
    }

    /**
     * Loading Screen
     */

    show = (condition?: () => boolean) => {
        this.clearFadeFallback();
        this.state = LoadingScreenState.VISIBLE;

        if (this.view.webContents.isLoading()) {
            this.view.webContents.once('did-finish-load', () => {
                if (this.view.webContents.isDestroyed() || this.parent.isDestroyed()) {
                    return;
                }
                if (this.state !== LoadingScreenState.VISIBLE) {
                    return;
                }

                this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);

                log.debug('show: did-finish-load fired, adding loading screen view');

                // Electron does a weird thing where even if the index is undefined, it will not add the view on top properly
                if (condition?.()) {
                    this.parent.contentView.addChildView(this.view, 1);
                } else {
                    this.parent.contentView.addChildView(this.view);
                }
            });
        } else {
            if (this.view.webContents.isDestroyed() || this.parent.isDestroyed()) {
                return;
            }
            this.view.webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, true);
            log.debug('show: not loading, adding loading screen view');
            if (condition?.()) {
                this.parent.contentView.addChildView(this.view, 1);
            } else {
                this.parent.contentView.addChildView(this.view);
            }
        }

        this.setBounds();
    };

    fade = () => {
        if (this.state === LoadingScreenState.VISIBLE) {
            log.debug('fade: fading loading screen');
            this.state = LoadingScreenState.FADING;
            const webContents = this.view.webContents;
            if (webContents && !webContents.isDestroyed()) {
                webContents.send(TOGGLE_LOADING_SCREEN_VISIBILITY, false);
            }

            // The renderer only reports the end of the fade through a chain of one-shot CSS events,
            // so make sure the view never stays on top of the window if one of them is missed
            this.fadeFallbackTimeout = setTimeout(() => {
                log.warn('fade: animation did not finish in time, removing loading screen');
                this.handleAnimationFinished();
            }, FADE_FALLBACK_TIMEOUT_MS);
        }
    };

    destroy = () => {
        this.clearFadeFallback();
        ipcMain.off(LOADING_SCREEN_ANIMATION_FINISHED, this.handleAnimationFinished);
        performanceMonitor.unregisterView(this.view.webContents.id);
        this.view.webContents.close();
    };

    registerThemeManager = (register: (webContents: WebContents) => void) => {
        register(this.view.webContents);
    };

    private handleAnimationFinished = () => {
        log.debug('handleLoadingScreenAnimationFinished');
        this.clearFadeFallback();

        if (this.state !== LoadingScreenState.HIDDEN) {
            this.state = LoadingScreenState.HIDDEN;
            this.parent.contentView.removeChildView(this.view);
        }

        if (process.env.NODE_ENV === 'test') {
            app.emit('e2e-app-loaded');
            this.parent.focus();
        }
    };

    private clearFadeFallback = () => {
        clearTimeout(this.fadeFallbackTimeout);
        delete this.fadeFallbackTimeout;
    };

    private setBounds = () => {
        this.view.setBounds(getWindowBoundaries(this.parent));
    };
}
