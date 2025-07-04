// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebContents, Event} from 'electron';
import {BrowserWindow, shell} from 'electron';

import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {
    isAdminUrl,
    isCallsPopOutURL,
    isChannelExportUrl,
    isHelpUrl,
    isImageProxyUrl,
    isInternalURL,
    isLoginUrl,
    isManagedResource,
    isPluginUrl,
    isPublicFilesUrl,
    isTeamUrl,
    isValidURI,
    parseURL,
} from 'common/utils/url';
import ContextMenu from 'main/contextMenu';
import PluginsPopUpsManager from 'main/views/pluginsPopUps';
import ViewManager from 'main/views/viewManager';
import CallsWidgetWindow from 'main/windows/callsWidgetWindow';
import MainWindow from 'main/windows/mainWindow';

import {generateHandleConsoleMessage, isCustomProtocol, isMattermostProtocol} from './webContentEventsCommon';

import allowProtocolDialog from '../allowProtocolDialog';
import {composeUserAgent} from '../utils';

const log = new Logger('WebContentsEventManager');

export class WebContentsEventManager {
    listeners: Record<number, () => void>;
    popupWindow?: {win: BrowserWindow; serverURL?: URL};

    constructor() {
        this.listeners = {};
    }

    private log = (webContentsId?: number) => {
        if (!webContentsId) {
            return log;
        }

        const view = ViewManager.getViewByWebContentsId(webContentsId);
        if (!view) {
            return log;
        }

        return ServerManager.getViewLog(view.id, 'WebContentsEventManager');
    };

    private isTrustedPopupWindow = (webContentsId: number) => {
        if (!this.popupWindow) {
            return false;
        }
        return webContentsId === this.popupWindow.win.webContents.id;
    };

    private getServerURLFromWebContentsId = (webContentsId: number) => {
        if (this.popupWindow && webContentsId === this.popupWindow.win.webContents.id) {
            return this.popupWindow.serverURL;
        }

        if (CallsWidgetWindow.isCallsWidget(webContentsId)) {
            return CallsWidgetWindow.getViewURL();
        }

        return ViewManager.getViewByWebContentsId(webContentsId)?.view.server.url;
    };

    private generateWillNavigate = (webContentsId: number) => {
        return (event: Event, url: string) => {
            this.log(webContentsId).debug('will-navigate', url);

            const parsedURL = parseURL(url)!;
            const serverURL = this.getServerURLFromWebContentsId(webContentsId);

            this.log(webContentsId).info(serverURL?.toString());

            if (serverURL && (isTeamUrl(serverURL, parsedURL) || isAdminUrl(serverURL, parsedURL) || isLoginUrl(serverURL, parsedURL) || this.isTrustedPopupWindow(webContentsId))) {
                return;
            }

            if (serverURL && isChannelExportUrl(serverURL, parsedURL)) {
                return;
            }

            if (parsedURL.protocol === 'mailto:') {
                return;
            }

            const callID = CallsWidgetWindow.callID;
            if (serverURL && callID && isCallsPopOutURL(serverURL, parsedURL, callID)) {
                return;
            }

            this.log(webContentsId).info(`Prevented desktop from navigating to: ${url}`);
            event.preventDefault();
        };
    };

    private denyNewWindow = (details: Electron.HandlerDetails): {action: 'deny' | 'allow'} => {
        this.log().warn(`Prevented popup window to open a new window to ${details.url}.`);
        return {action: 'deny'};
    };

    private generateNewWindowListener = (webContentsId: number, spellcheck?: boolean) => {
        return (details: Electron.HandlerDetails): {action: 'deny' | 'allow'} => {
            this.log(webContentsId).debug('new-window', details.url);

            const parsedURL = parseURL(details.url);
            if (!parsedURL) {
                this.log(webContentsId).warn(`Ignoring non-url ${details.url}`);
                return {action: 'deny'};
            }

            // Dev tools case
            if (parsedURL.protocol === 'devtools:') {
                return {action: 'allow'};
            }

            // Allow plugins to open blank popup windows.
            if (parsedURL.toString() === 'about:blank') {
                return PluginsPopUpsManager.handleNewWindow(webContentsId, details);
            }

            // Check for mattermost protocol - handle internally
            if (isMattermostProtocol(parsedURL)) {
                ViewManager.handleDeepLink(parsedURL);
                return {action: 'deny'};
            }

            // Check for other custom protocols
            if (isCustomProtocol(parsedURL)) {
                allowProtocolDialog.handleDialogEvent(parsedURL.protocol, details.url);
                return {action: 'deny'};
            }

            // Check for valid URL
            // Let the browser handle invalid URIs
            if (!isValidURI(details.url)) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            const serverURL = this.getServerURLFromWebContentsId(webContentsId);
            if (!serverURL) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            // Public download links case
            // we are going to mimic the browser and just pop a new browser window for public links
            if (isPublicFilesUrl(serverURL, parsedURL)) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            // Image proxy case
            if (isImageProxyUrl(serverURL, parsedURL)) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            if (isHelpUrl(serverURL, parsedURL)) {
                // Help links case
                // continue to open special case internal urls in default browser
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            if (isTeamUrl(serverURL, parsedURL, true)) {
                ViewManager.handleDeepLink(parsedURL);
                return {action: 'deny'};
            }
            if (isAdminUrl(serverURL, parsedURL)) {
                this.log(webContentsId).info(`${details.url} is an admin console page, preventing to open a new window`);
                return {action: 'deny'};
            }
            if (this.popupWindow && this.popupWindow.win.webContents.getURL() === details.url) {
                this.log(webContentsId).info(`Popup window already open at provided url: ${details.url}`);
                return {action: 'deny'};
            }

            // TODO: move popups to its own and have more than one.
            if (isPluginUrl(serverURL, parsedURL) || isManagedResource(serverURL, parsedURL)) {
                let popup: BrowserWindow;
                if (this.popupWindow) {
                    this.popupWindow.win.once('ready-to-show', () => {
                        this.popupWindow?.win.show();
                    });
                    popup = this.popupWindow.win;
                } else {
                    this.popupWindow = {
                        win: new BrowserWindow({
                            backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
                            parent: MainWindow.get(),
                            show: false,
                            center: true,
                            webPreferences: {
                                spellcheck: (typeof spellcheck === 'undefined' ? true : spellcheck),
                            },
                        }),
                        serverURL,
                    };

                    popup = this.popupWindow.win;
                    popup.webContents.on('will-redirect', (event, url) => {
                        const parsedURL = parseURL(url);
                        if (!parsedURL) {
                            event.preventDefault();
                            return;
                        }

                        if (isInternalURL(serverURL, parsedURL) && !isPluginUrl(serverURL, parsedURL) && !isManagedResource(serverURL, parsedURL)) {
                            event.preventDefault();
                        }
                    });
                    popup.webContents.on('will-navigate', this.generateWillNavigate(popup.webContents.id));
                    popup.webContents.setWindowOpenHandler(this.denyNewWindow);
                    popup.once('closed', () => {
                        this.popupWindow = undefined;
                    });

                    const contextMenu = new ContextMenu({}, popup);
                    contextMenu.reload();
                }

                popup.once('ready-to-show', () => popup.show());

                if (isManagedResource(serverURL, parsedURL)) {
                    popup.loadURL(details.url);
                } else {
                    // currently changing the userAgent for popup windows to allow plugins to go through google's oAuth
                    // should be removed once a proper oAuth2 implementation is setup.
                    popup.loadURL(details.url, {
                        userAgent: composeUserAgent(),
                    });
                }

                return {action: 'deny'};
            }

            const otherServerURL = ServerManager.lookupViewByURL(parsedURL);
            if (otherServerURL && isTeamUrl(otherServerURL.server.url, parsedURL, true)) {
                ViewManager.handleDeepLink(parsedURL);
                return {action: 'deny'};
            }

            // If all else fails, just open externally
            shell.openExternal(details.url);
            return {action: 'deny'};
        };
    };

    removeWebContentsListeners = (id: number) => {
        if (this.listeners[id]) {
            this.listeners[id]();
        }
    };

    addWebContentsEventListeners = (
        contents: WebContents,
        addListeners?: (contents: WebContents) => void,
        removeListeners?: (contents: WebContents) => void,
    ) => {
        if (this.listeners[contents.id]) {
            this.removeWebContentsListeners(contents.id);
        }

        const willNavigate = this.generateWillNavigate(contents.id);
        contents.on('will-navigate', willNavigate);

        const spellcheck = Config.useSpellChecker;
        const newWindow = this.generateNewWindowListener(contents.id, spellcheck);
        contents.setWindowOpenHandler(newWindow);

        // Defer handling of new popup windows to PluginsPopUpsManager. These still need to be
        // previously allowed from generateNewWindowListener through PluginsPopUpsManager.handleNewWindow.
        contents.on('did-create-window', PluginsPopUpsManager.generateHandleCreateWindow(contents.id));

        const consoleMessage = generateHandleConsoleMessage(this.log(contents.id));
        contents.on('console-message', consoleMessage);

        addListeners?.(contents);

        const removeWebContentsListeners = () => {
            try {
                contents.removeListener('will-navigate', willNavigate);
                contents.removeListener('console-message', consoleMessage);
                removeListeners?.(contents);
            } catch (e) {
                this.log(contents.id).error(`Error while trying to detach listeners, this might be ok if the process crashed: ${e}`);
            }
        };

        this.listeners[contents.id] = removeWebContentsListeners;
        contents.once('render-process-gone', (event, details) => {
            if (details.reason !== 'clean-exit') {
                this.log(contents.id).error('Renderer process for a webcontent is no longer available:', details.reason);
            }
            removeWebContentsListeners();
        });
    };
}

const webContentsEventManager = new WebContentsEventManager();
export default webContentsEventManager;
