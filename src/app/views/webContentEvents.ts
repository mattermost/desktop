// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    WebContents,
    Event,
    WebContentsWillNavigateEventParams,
    WebContentsWillRedirectEventParams,
} from 'electron';
import {BrowserWindow, dialog, shell} from 'electron';

import CallsWidgetWindow from 'app/callsWidgetWindow';
import MainWindow from 'app/mainWindow/mainWindow';
import NavigationManager from 'app/navigationManager';
import PluginsPopUpsManager from 'app/views/pluginsPopUps';
import WebContentsManager from 'app/views/webContentsManager';
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
    parseURL,
} from 'common/utils/url';
import ViewManager from 'common/views/viewManager';
import ContextMenu from 'main/contextMenu';
import {localizeMessage} from 'main/i18nManager';

import {generateHandleConsoleMessage, generateWillFrameNavigate, isCustomProtocol, isMattermostProtocol} from './webContentEventsCommon';

import allowProtocolDialog from '../../main/security/allowProtocolDialog';
import {composeUserAgent} from '../../main/utils';

const log = new Logger('WebContentsEventManager');

export class WebContentsEventManager {
    listeners: Record<number, () => void>;
    popupWindow?: {win: BrowserWindow; serverURL?: URL; contextMenu?: ContextMenu};

    constructor() {
        this.listeners = {};
    }

    private log = (webContentsId?: number) => {
        if (!webContentsId) {
            return log;
        }

        const view = WebContentsManager.getViewByWebContentsId(webContentsId);
        if (!view) {
            return log;
        }

        return ViewManager.getViewLog(view.id, 'WebContentsEventManager');
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

        const view = WebContentsManager.getViewByWebContentsId(webContentsId);
        if (!view) {
            return undefined;
        }
        const server = ServerManager.getServer(view.serverId);
        if (!server) {
            return undefined;
        }
        return server.url;
    };

    /**
     * Chromium upgrades main-frame http:// navigations to https:// (HTTPS-Upgrades/HSTS) and
     * reports it as a main-frame redirect. Returns the configured server URL with the upgraded
     * scheme so the destination is still recognized as the server. Downgrades are not allowed.
     */
    private getHttpsUpgradedServerURL = (serverURL: URL, parsedURL: URL) => {
        if (serverURL.protocol !== 'http:' || parsedURL.protocol !== 'https:') {
            return undefined;
        }
        if (!isInternalURL(parsedURL, serverURL, true)) {
            return undefined;
        }
        const upgraded = new URL(serverURL.toString());
        upgraded.protocol = 'https:';
        return upgraded;
    };

    private isAllowedServerNavigation = (serverURL: URL, parsedURL: URL, webContentsId: number) => {
        const effectiveServerURL = this.getHttpsUpgradedServerURL(serverURL, parsedURL) ?? serverURL;

        if (isTeamUrl(effectiveServerURL, parsedURL) || isAdminUrl(effectiveServerURL, parsedURL) || isLoginUrl(effectiveServerURL, parsedURL) || this.isTrustedPopupWindow(webContentsId)) {
            return true;
        }

        if (isChannelExportUrl(effectiveServerURL, parsedURL)) {
            return true;
        }

        const callID = CallsWidgetWindow.callID;
        if (callID && isCallsPopOutURL(effectiveServerURL, parsedURL, callID)) {
            return true;
        }

        return false;
    };

    /**
     * The app loads server URLs itself (initial load, deep links). Chromium may upgrade such a
     * load to https and surface it as a redirect, and cancelling that would cancel our own
     * navigation — including paths the allowlist deliberately excludes for renderer-initiated
     * navigation, such as /oauth/. Only the scheme may differ; host, path and query must match
     * what we asked for, so a server cannot redirect the view anywhere else through this path.
     */
    private isHttpsUpgradeOfAppInitiatedLoad = (webContentsId: number, parsedURL: URL) => {
        const pendingLoadURL = WebContentsManager.getViewByWebContentsId(webContentsId)?.pendingLoadURL;
        if (!pendingLoadURL) {
            return false;
        }

        return pendingLoadURL.protocol === 'http:' &&
            parsedURL.protocol === 'https:' &&
            pendingLoadURL.host === parsedURL.host &&
            pendingLoadURL.pathname === parsedURL.pathname &&
            pendingLoadURL.search === parsedURL.search;
    };

    private generateWillNavigate = (webContentsId: number) => {
        return (event: Event<WebContentsWillNavigateEventParams>, url?: string) => {
            this.log(webContentsId).debug('will-navigate');

            const navigationURL = url || event.url;
            const parsedURL = parseURL(navigationURL);
            if (!parsedURL) {
                this.log(webContentsId).warn(`Prevented navigation to invalid URL: ${navigationURL}`);
                event.preventDefault();
                return;
            }

            const serverURL = this.getServerURLFromWebContentsId(webContentsId);

            if (serverURL && this.isAllowedServerNavigation(serverURL, parsedURL, webContentsId)) {
                return;
            }

            if (this.isHttpsUpgradeOfAppInitiatedLoad(webContentsId, parsedURL)) {
                return;
            }

            if (parsedURL.protocol === 'mailto:') {
                return;
            }

            if (isCustomProtocol(parsedURL)) {
                allowProtocolDialog.handleDialogEvent(navigationURL).catch((err) => {
                    this.log(webContentsId).warn('Error handling custom protocol dialog', err);
                });
                event.preventDefault();
                return;
            }

            this.log(webContentsId).info('Prevented desktop from navigating to external URL');
            event.preventDefault();
        };
    };

    private denyNewWindow = (): {action: 'deny' | 'allow'} => {
        this.log().warn('Prevented popup window from opening a new window');
        return {action: 'deny'};
    };

    private generateNewWindowListener = (webContentsId: number, spellcheck?: boolean) => {
        return (details: Electron.HandlerDetails): {action: 'deny' | 'allow'} => {
            this.log(webContentsId).debug('new-window');

            const parsedURL = parseURL(details.url);
            if (!parsedURL) {
                this.log(webContentsId).warn(`Ignoring invalid URL: ${details.url}`);
                dialog.showErrorBox(
                    localizeMessage('main.webContentEvents.invalidLinkTitle', 'Invalid Link'),
                    localizeMessage(
                        'main.webContentEvents.invalidLinkDescription',
                        'The link you clicked appears to be malformed and cannot be opened. Please check the URL for errors before trying again.',
                    ),
                );
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
                NavigationManager.openLinkInNewTab(parsedURL);
                return {action: 'deny'};
            }

            // Check for other custom protocols
            if (isCustomProtocol(parsedURL)) {
                allowProtocolDialog.handleDialogEvent(details.url).catch((err) => {
                    this.log(webContentsId).warn('Error handling custom protocol dialog', err);
                });
                return {action: 'deny'};
            }

            const serializedURL = parsedURL.toString();

            const serverURL = this.getServerURLFromWebContentsId(webContentsId);
            if (!serverURL) {
                shell.openExternal(serializedURL);
                return {action: 'deny'};
            }

            // Public download links case
            // we are going to mimic the browser and just pop a new browser window for public links
            if (isPublicFilesUrl(serverURL, parsedURL)) {
                shell.openExternal(serializedURL);
                return {action: 'deny'};
            }

            // Image proxy case
            if (isImageProxyUrl(serverURL, parsedURL)) {
                shell.openExternal(serializedURL);
                return {action: 'deny'};
            }

            if (isHelpUrl(serverURL, parsedURL)) {
                // Help links case
                // continue to open special case internal urls in default browser
                shell.openExternal(serializedURL);
                return {action: 'deny'};
            }

            if (isTeamUrl(serverURL, parsedURL, true)) {
                NavigationManager.openLinkInNewTab(parsedURL);
                return {action: 'deny'};
            }
            if (isAdminUrl(serverURL, parsedURL)) {
                this.log(webContentsId).info('Admin console page detected, preventing new window');
                return {action: 'deny'};
            }
            if (this.popupWindow && this.popupWindow.win.webContents.getURL() === serializedURL) {
                this.log(webContentsId).info('Popup window already open at provided URL');
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
                    popup.webContents.on('will-frame-navigate', generateWillFrameNavigate(this.log(popup.webContents.id)));
                    popup.webContents.setWindowOpenHandler(this.denyNewWindow);
                    popup.once('closed', () => {
                        if (this.popupWindow?.contextMenu) {
                            this.popupWindow.contextMenu.dispose();
                        }
                        this.popupWindow = undefined;
                    });

                    this.popupWindow.contextMenu = new ContextMenu({}, popup);
                    this.popupWindow.contextMenu.reload();
                }

                popup.once('ready-to-show', () => popup.show());

                if (isManagedResource(serverURL, parsedURL)) {
                    popup.loadURL(serializedURL);
                } else {
                    // currently changing the userAgent for popup windows to allow plugins to go through google's oAuth
                    // should be removed once a proper oAuth2 implementation is setup.
                    popup.loadURL(serializedURL, {
                        userAgent: composeUserAgent(),
                    });
                }

                return {action: 'deny'};
            }

            const otherServerURL = ServerManager.lookupServerByURL(parsedURL);
            if (otherServerURL && isTeamUrl(otherServerURL.url, parsedURL, true)) {
                NavigationManager.openLinkInNewTab(parsedURL);
                return {action: 'deny'};
            }

            // If all else fails, just open externally
            shell.openExternal(serializedURL);
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
        const willFrameNavigate = generateWillFrameNavigate(this.log(contents.id));

        // Unlike will-navigate, will-redirect fires for subframes as well, so each frame
        // type needs to be evaluated against its own policy.
        const willRedirect = (event: Event<WebContentsWillRedirectEventParams>, url?: string) => {
            if (event.isMainFrame) {
                willNavigate(event, url);
            } else {
                willFrameNavigate(event);
            }
        };

        contents.on('will-navigate', willNavigate);
        contents.on('will-frame-navigate', willFrameNavigate);
        contents.on('will-redirect', willRedirect);

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
                contents.removeListener('will-frame-navigate', willFrameNavigate);
                contents.removeListener('will-redirect', willRedirect);
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
