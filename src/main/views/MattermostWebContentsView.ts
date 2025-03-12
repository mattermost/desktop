// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebContentsView, app, ipcMain} from 'electron';
import type {WebContentsViewConstructorOptions, Event, Input} from 'electron/main';
import {EventEmitter} from 'events';
import semver from 'semver';

import AppState from 'common/appState';
import {
    LOAD_RETRY,
    LOAD_SUCCESS,
    LOAD_FAILED,
    UPDATE_TARGET_URL,
    LOADSCREEN_END,
    SERVERS_URL_MODIFIED,
    BROWSER_HISTORY_STATUS_UPDATED,
    CLOSE_SERVERS_DROPDOWN,
    CLOSE_DOWNLOADS_DROPDOWN,
    LOAD_INCOMPATIBLE_SERVER,
} from 'common/communication';
import type {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {RELOAD_INTERVAL, MAX_SERVER_RETRIES, SECOND, MAX_LOADING_SCREEN_SECONDS} from 'common/utils/constants';
import {isInternalURL, parseURL} from 'common/utils/url';
import {TAB_MESSAGING, type MattermostView} from 'common/views/View';
import {updateServerInfos} from 'main/app/utils';
import DeveloperMode from 'main/developerMode';
import performanceMonitor from 'main/performanceMonitor';
import {getServerAPI} from 'main/server/serverAPI';
import MainWindow from 'main/windows/mainWindow';

import WebContentsEventManager from './webContentEvents';

import ContextMenu from '../contextMenu';
import {getWindowBoundaries, getLocalPreload, composeUserAgent} from '../utils';

enum Status {
    LOADING,
    READY,
    WAITING_MM,
    ERROR = -1,
}
export class MattermostWebContentsView extends EventEmitter {
    view: MattermostView;
    isVisible: boolean;

    private log: Logger;
    private webContentsView: WebContentsView;
    private loggedIn: boolean;
    private atRoot: boolean;
    private options: WebContentsViewConstructorOptions;
    private removeLoading?: NodeJS.Timeout;
    private contextMenu?: ContextMenu;
    private status?: Status;
    private retryLoad?: NodeJS.Timeout;
    private maxRetries: number;
    private altPressStatus: boolean;

    constructor(view: MattermostView, options: WebContentsViewConstructorOptions) {
        super();
        this.view = view;

        const preload = getLocalPreload('externalAPI.js');
        this.options = Object.assign({}, options);
        this.options.webPreferences = {
            preload: DeveloperMode.get('browserOnly') ? undefined : preload,
            additionalArguments: [
                `version=${app.getVersion()}`,
                `appName=${app.name}`,
            ],
            ...options.webPreferences,
        };
        this.isVisible = false;
        this.loggedIn = false;
        this.atRoot = true;
        this.webContentsView = new WebContentsView(this.options);
        this.resetLoadingStatus();

        this.log = ServerManager.getViewLog(this.id, 'MattermostWebContentsView');
        this.log.verbose('View created');

        this.webContentsView.webContents.on('update-target-url', this.handleUpdateTarget);
        if (process.platform !== 'darwin') {
            this.webContentsView.webContents.on('before-input-event', this.handleInputEvents);
        }
        this.webContentsView.webContents.on('input-event', (_, inputEvent) => {
            if (inputEvent.type === 'mouseDown') {
                ipcMain.emit(CLOSE_SERVERS_DROPDOWN);
                ipcMain.emit(CLOSE_DOWNLOADS_DROPDOWN);
            }
        });

        WebContentsEventManager.addWebContentsEventListeners(this.webContentsView.webContents);

        if (!DeveloperMode.get('disableContextMenu')) {
            this.contextMenu = new ContextMenu({}, this.webContentsView.webContents);
        }
        this.maxRetries = MAX_SERVER_RETRIES;

        this.altPressStatus = false;

        MainWindow.get()?.on('blur', () => {
            this.altPressStatus = false;
        });

        ServerManager.on(SERVERS_URL_MODIFIED, this.handleServerWasModified);
    }

    get id() {
        return this.view.id;
    }
    get isAtRoot() {
        return this.atRoot;
    }
    get isLoggedIn() {
        return this.loggedIn;
    }
    get currentURL() {
        return parseURL(this.webContentsView.webContents.getURL());
    }
    get webContentsId() {
        return this.webContentsView.webContents.id;
    }

    onLogin = (loggedIn: boolean) => {
        if (this.isLoggedIn === loggedIn) {
            return;
        }

        this.loggedIn = loggedIn;

        // If we're logging in from a different view, force a reload
        if (loggedIn &&
            this.currentURL?.toString() !== this.view.url.toString() &&
            !this.currentURL?.toString().startsWith(this.view.url.toString())
        ) {
            this.reload();
        }
    };

    goToOffset = (offset: number) => {
        if (this.webContentsView.webContents.navigationHistory.canGoToOffset(offset)) {
            try {
                this.webContentsView.webContents.navigationHistory.goToOffset(offset);
                this.updateHistoryButton();
            } catch (error) {
                this.log.error(error);
                this.reload();
            }
        }
    };

    getBrowserHistoryStatus = () => {
        if (this.currentURL?.toString() === this.view.url.toString()) {
            this.webContentsView.webContents.navigationHistory.clear();
            this.atRoot = true;
        } else {
            this.atRoot = false;
        }

        return {
            canGoBack: this.webContentsView.webContents.navigationHistory.canGoBack(),
            canGoForward: this.webContentsView.webContents.navigationHistory.canGoForward(),
        };
    };

    updateHistoryButton = () => {
        const {canGoBack, canGoForward} = this.getBrowserHistoryStatus();
        this.webContentsView.webContents.send(BROWSER_HISTORY_STATUS_UPDATED, canGoBack, canGoForward);
    };

    load = (someURL?: URL | string) => {
        if (!this.webContentsView) {
            return;
        }

        let loadURL: string;
        if (someURL) {
            const parsedURL = parseURL(someURL);
            if (parsedURL) {
                loadURL = parsedURL.toString();
            } else {
                this.log.error('Cannot parse provided url, using current server url', someURL);
                loadURL = this.view.url.toString();
            }
        } else {
            loadURL = this.view.url.toString();
        }
        this.log.verbose(`Loading ${loadURL}`);
        if (this.view.type === TAB_MESSAGING) {
            performanceMonitor.registerServerView(`Server ${this.webContentsView.webContents.id}`, this.webContentsView.webContents, this.view.server.id);
        } else {
            performanceMonitor.registerView(`Server ${this.webContentsView.webContents.id}`, this.webContentsView.webContents, this.view.server.id);
        }
        const loading = this.webContentsView.webContents.loadURL(loadURL, {userAgent: composeUserAgent(DeveloperMode.get('browserOnly'))});
        loading.then(this.loadSuccess(loadURL)).catch((err) => {
            if (err.code && err.code.startsWith('ERR_CERT')) {
                MainWindow.sendToRenderer(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                this.emit(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                this.log.info(`Invalid certificate, stop retrying until the user decides what to do: ${err}.`);
                this.status = Status.ERROR;
                return;
            }
            if (err.code && err.code.startsWith('ERR_ABORTED')) {
                // If the loading was aborted, we shouldn't be retrying
                return;
            }
            this.loadRetry(loadURL, err);
        });
    };

    show = () => {
        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return;
        }
        if (!this.currentURL) {
            return;
        }
        if (this.isVisible) {
            return;
        }
        this.isVisible = true;
        mainWindow.contentView.addChildView(this.webContentsView);
        this.setBounds(getWindowBoundaries(mainWindow));
        if (this.status === Status.READY) {
            this.focus();
        }
    };

    hide = () => {
        if (this.isVisible) {
            this.isVisible = false;
            MainWindow.get()?.contentView.removeChildView(this.webContentsView);
        }
    };

    reload = (loadURL?: URL | string) => {
        this.resetLoadingStatus();
        AppState.updateExpired(this.id, false);
        this.load(loadURL);
    };

    getBounds = () => {
        return this.webContentsView.getBounds();
    };

    openFind = () => {
        this.webContentsView.webContents.sendInputEvent({type: 'keyDown', keyCode: 'F', modifiers: [process.platform === 'darwin' ? 'cmd' : 'ctrl', 'shift']});
    };

    setBounds = (boundaries: Electron.Rectangle) => {
        this.webContentsView.setBounds(boundaries);
    };

    destroy = () => {
        WebContentsEventManager.removeWebContentsListeners(this.webContentsId);
        AppState.clear(this.id);
        performanceMonitor.unregisterView(this.webContentsView.webContents.id);
        MainWindow.get()?.contentView.removeChildView(this.webContentsView);
        this.webContentsView.webContents.close();

        this.isVisible = false;
        if (this.retryLoad) {
            clearTimeout(this.retryLoad);
        }
        if (this.removeLoading) {
            clearTimeout(this.removeLoading);
        }
    };

    /**
     * Status hooks
     */

    resetLoadingStatus = () => {
        if (this.status !== Status.LOADING) { // if it's already loading, don't touch anything
            delete this.retryLoad;
            this.status = Status.LOADING;
            this.maxRetries = MAX_SERVER_RETRIES;
        }
    };

    isReady = () => {
        return this.status === Status.READY;
    };

    isErrored = () => {
        return this.status === Status.ERROR;
    };

    needsLoadingScreen = () => {
        return !(this.status === Status.READY || this.status === Status.ERROR);
    };

    setInitialized = (timedout?: boolean) => {
        this.status = Status.READY;

        if (timedout) {
            this.log.verbose('timeout expired will show the browserview');
            this.emit(LOADSCREEN_END, this.id);
        }
        clearTimeout(this.removeLoading);
        delete this.removeLoading;
    };

    openDevTools = () => {
        // Workaround for a bug with our Dev Tools on Mac
        // For some reason if you open two Dev Tools windows and close the first one, it won't register the closing
        // So what we do here is check to see if it's opened correctly and if not we reset it
        if (process.platform === 'darwin') {
            const timeout = setTimeout(() => {
                if (this.webContentsView.webContents.isDevToolsOpened()) {
                    this.webContentsView.webContents.closeDevTools();
                    this.webContentsView.webContents.openDevTools({mode: 'detach'});
                }
            }, 500);
            this.webContentsView.webContents.on('devtools-opened', () => {
                clearTimeout(timeout);
            });
        }

        this.webContentsView.webContents.openDevTools({mode: 'detach'});
    };

    /**
     * WebContents hooks
     */

    sendToRenderer = (channel: string, ...args: any[]) => {
        this.webContentsView.webContents.send(channel, ...args);
    };

    isDestroyed = () => {
        return this.webContentsView.webContents.isDestroyed();
    };

    focus = () => {
        if (this.webContentsView.webContents) {
            this.webContentsView.webContents.focus();
        } else {
            this.log.warn('trying to focus the browserview, but it doesn\'t yet have webcontents.');
        }
    };

    /**
     * ALT key handling for the 3-dot menu (Windows/Linux)
     */

    private registerAltKeyPressed = (input: Input) => {
        const isAltPressed = input.key === 'Alt' && input.alt === true && input.control === false && input.shift === false && input.meta === false;

        if (input.type === 'keyDown') {
            this.altPressStatus = isAltPressed;
        }

        if (input.key !== 'Alt') {
            this.altPressStatus = false;
        }
    };

    private isAltKeyReleased = (input: Input) => {
        return input.type === 'keyUp' && this.altPressStatus === true;
    };

    private handleInputEvents = (_: Event, input: Input) => {
        this.log.silly('handleInputEvents', input);

        this.registerAltKeyPressed(input);

        if (this.isAltKeyReleased(input)) {
            MainWindow.focusThreeDotMenu();
        }
    };

    /**
     * Loading/retry logic
     */

    private retry = (loadURL: string) => {
        return () => {
            // window was closed while retrying
            if (!this.webContentsView || !this.webContentsView.webContents) {
                return;
            }
            const loading = this.webContentsView.webContents.loadURL(loadURL, {userAgent: composeUserAgent(DeveloperMode.get('browserOnly'))});
            loading.then(this.loadSuccess(loadURL)).catch((err) => {
                if (this.maxRetries-- > 0) {
                    this.loadRetry(loadURL, err);
                } else {
                    MainWindow.sendToRenderer(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                    this.emit(LOAD_FAILED, this.id, err.toString(), loadURL.toString());
                    this.log.info(`Couldn't esviewlish a connection with ${loadURL}, will continue to retry in the background`, err);
                    this.status = Status.ERROR;
                    this.retryLoad = setTimeout(this.retryInBackground(loadURL), RELOAD_INTERVAL);
                }
            });
        };
    };

    private retryInBackground = (loadURL: string) => {
        return () => {
            // window was closed while retrying
            if (!this.webContentsView || !this.webContentsView.webContents) {
                return;
            }
            const parsedURL = parseURL(loadURL);
            if (!parsedURL) {
                return;
            }
            getServerAPI(
                parsedURL,
                false,
                async () => {
                    await updateServerInfos([this.view.server]);
                    this.reload(loadURL);
                },
                () => {},
                (error: Error) => {
                    this.log.debug(`Cannot reach server: ${error}`);
                    this.retryLoad = setTimeout(this.retryInBackground(loadURL), RELOAD_INTERVAL);
                });
        };
    };

    private loadRetry = (loadURL: string, err: Error) => {
        this.retryLoad = setTimeout(this.retry(loadURL), RELOAD_INTERVAL);
        MainWindow.sendToRenderer(LOAD_RETRY, this.id, Date.now() + RELOAD_INTERVAL, err.toString(), loadURL.toString());
        this.log.info(`failed loading ${loadURL}: ${err}, retrying in ${RELOAD_INTERVAL / SECOND} seconds`);
    };

    private loadSuccess = (loadURL: string) => {
        return () => {
            const serverInfo = ServerManager.getRemoteInfo(this.view.server.id);
            if (!serverInfo?.serverVersion || semver.gte(serverInfo.serverVersion, '9.4.0')) {
                this.log.verbose(`finished loading ${loadURL}`);
                MainWindow.sendToRenderer(LOAD_SUCCESS, this.id);
                this.maxRetries = MAX_SERVER_RETRIES;
                this.status = Status.WAITING_MM;
                this.removeLoading = setTimeout(this.setInitialized, MAX_LOADING_SCREEN_SECONDS, true);
                this.emit(LOAD_SUCCESS, this.id, loadURL);
                const mainWindow = MainWindow.get();
                if (mainWindow && this.currentURL) {
                    this.setBounds(getWindowBoundaries(mainWindow));
                }
            } else {
                MainWindow.sendToRenderer(LOAD_INCOMPATIBLE_SERVER, this.id, loadURL.toString());
                this.emit(LOAD_FAILED, this.id, 'Incompatible server version', loadURL.toString());
                this.status = Status.ERROR;
            }
        };
    };

    /**
     * WebContents event handlers
     */

    private handleUpdateTarget = (e: Event, url: string) => {
        this.log.silly('handleUpdateTarget', e, url);
        const parsedURL = parseURL(url);
        if (parsedURL && isInternalURL(parsedURL, this.view.server.url)) {
            this.emit(UPDATE_TARGET_URL);
        } else {
            this.emit(UPDATE_TARGET_URL, url);
        }
    };

    private handleServerWasModified = (serverIds: string) => {
        if (serverIds.includes(this.view.server.id)) {
            this.reload();
        }
    };
}
