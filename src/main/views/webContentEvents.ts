// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, session, shell, WebContents} from 'electron';
import log from 'electron-log';

import Config from 'common/config';
import urlUtils from 'common/utils/url';

import {flushCookiesStore} from 'main/app/utils';
import ContextMenu from 'main/contextMenu';

import WindowManager from '../windows/windowManager';

import {protocols} from '../../../electron-builder.json';

import allowProtocolDialog from '../allowProtocolDialog';
import {composeUserAgent} from '../utils';

import {MattermostView} from './MattermostView';

type CustomLogin = {
    inProgress: boolean;
}

const scheme = protocols && protocols[0] && protocols[0].schemes && protocols[0].schemes[0];

export class WebContentsEventManager {
    customLogins: Record<number, CustomLogin>;
    listeners: Record<number, () => void>;
    popupWindow?: {win: BrowserWindow; serverURL?: URL};

    constructor() {
        this.customLogins = {};
        this.listeners = {};
    }

    private isTrustedPopupWindow = (webContentsId: number) => {
        if (!this.popupWindow) {
            return false;
        }
        return webContentsId === this.popupWindow.win.webContents.id;
    }

    private getServerURLFromWebContentsId = (webContentsId: number) => {
        if (this.popupWindow && webContentsId === this.popupWindow.win.webContents.id) {
            return this.popupWindow.serverURL;
        }

        return WindowManager.getServerURLFromWebContentsId(webContentsId);
    }

    generateWillNavigate = (webContentsId: number) => {
        return (event: Event, url: string) => {
            log.debug('webContentEvents.will-navigate', {webContentsId, url});

            const parsedURL = urlUtils.parseURL(url)!;
            const serverURL = this.getServerURLFromWebContentsId(webContentsId);

            if (serverURL && (urlUtils.isTeamUrl(serverURL, parsedURL) || urlUtils.isAdminUrl(serverURL, parsedURL) || this.isTrustedPopupWindow(webContentsId))) {
                return;
            }

            if (serverURL && urlUtils.isChannelExportUrl(serverURL, parsedURL)) {
                return;
            }

            if (serverURL && urlUtils.isCustomLoginURL(parsedURL, serverURL)) {
                return;
            }
            if (parsedURL.protocol === 'mailto:') {
                return;
            }
            if (this.customLogins[webContentsId]?.inProgress) {
                flushCookiesStore(session.defaultSession);
                return;
            }

            const callID = WindowManager.callsWidgetWindow?.getCallID();
            if (serverURL && callID && urlUtils.isCallsPopOutURL(serverURL, parsedURL, callID)) {
                return;
            }

            log.info(`Prevented desktop from navigating to: ${url}`);
            event.preventDefault();
        };
    };

    generateDidStartNavigation = (webContentsId: number) => {
        return (event: Event, url: string) => {
            log.debug('webContentEvents.did-start-navigation', {webContentsId, url});

            const parsedURL = urlUtils.parseURL(url)!;
            const serverURL = this.getServerURLFromWebContentsId(webContentsId);

            if (!serverURL || !urlUtils.isTrustedURL(parsedURL, serverURL)) {
                return;
            }

            if (serverURL && urlUtils.isCustomLoginURL(parsedURL, serverURL)) {
                this.customLogins[webContentsId].inProgress = true;
            } else if (serverURL && this.customLogins[webContentsId].inProgress && urlUtils.isInternalURL(serverURL || new URL(''), parsedURL)) {
                this.customLogins[webContentsId].inProgress = false;
            }
        };
    };

    denyNewWindow = (details: Electron.HandlerDetails): {action: 'deny' | 'allow'} => {
        log.warn(`Prevented popup window to open a new window to ${details.url}.`);
        return {action: 'deny'};
    };

    generateNewWindowListener = (webContentsId: number, spellcheck?: boolean) => {
        return (details: Electron.HandlerDetails): {action: 'deny' | 'allow'} => {
            log.debug('webContentEvents.new-window', details.url);

            const parsedURL = urlUtils.parseURL(details.url);
            if (!parsedURL) {
                log.warn(`Ignoring non-url ${details.url}`);
                return {action: 'deny'};
            }

            // Dev tools case
            if (parsedURL.protocol === 'devtools:') {
                return {action: 'allow'};
            }

            // Check for custom protocol
            if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:' && parsedURL.protocol !== `${scheme}:`) {
                allowProtocolDialog.handleDialogEvent(parsedURL.protocol, details.url);
                return {action: 'deny'};
            }

            // Check for valid URL
            // Let the browser handle invalid URIs
            if (!urlUtils.isValidURI(details.url)) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            const serverURL = this.getServerURLFromWebContentsId(webContentsId);
            if (!serverURL) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            // Public download links case
            // TODO: We might be handling different types differently in the future, for now
            // we are going to mimic the browser and just pop a new browser window for public links
            if (parsedURL.pathname.match(/^(\/api\/v[3-4]\/public)*\/files\//)) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            // Image proxy case
            if (parsedURL.pathname.match(/^\/api\/v[3-4]\/image/)) {
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            if (parsedURL.pathname.match(/^\/help\//)) {
                // Help links case
                // continue to open special case internal urls in default browser
                shell.openExternal(details.url);
                return {action: 'deny'};
            }

            if (urlUtils.isTeamUrl(serverURL, parsedURL, true)) {
                WindowManager.showMainWindow(parsedURL);
                return {action: 'deny'};
            }
            if (urlUtils.isAdminUrl(serverURL, parsedURL)) {
                log.info(`${details.url} is an admin console page, preventing to open a new window`);
                return {action: 'deny'};
            }
            if (this.popupWindow && this.popupWindow.win.webContents.getURL() === details.url) {
                log.info(`Popup window already open at provided url: ${details.url}`);
                return {action: 'deny'};
            }

            // TODO: move popups to its own and have more than one.
            if (urlUtils.isPluginUrl(serverURL, parsedURL) || urlUtils.isManagedResource(serverURL, parsedURL)) {
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
                            //parent: WindowManager.getMainWindow(),
                            show: false,
                            center: true,
                            webPreferences: {
                                spellcheck: (typeof spellcheck === 'undefined' ? true : spellcheck),
                            },
                        }),
                        serverURL,
                    };
                    this.customLogins[this.popupWindow.win.webContents.id] = {
                        inProgress: false,
                    };

                    popup = this.popupWindow.win;
                    popup.webContents.on('will-redirect', (event, url) => {
                        const parsedURL = urlUtils.parseURL(url);
                        if (!parsedURL) {
                            event.preventDefault();
                            return;
                        }

                        if (urlUtils.isInternalURL(serverURL, parsedURL) && !urlUtils.isPluginUrl(serverURL, parsedURL) && !urlUtils.isManagedResource(serverURL, parsedURL)) {
                            event.preventDefault();
                        }
                    });
                    popup.webContents.on('will-navigate', this.generateWillNavigate(popup.webContents.id));
                    popup.webContents.on('did-start-navigation', this.generateDidStartNavigation(popup.webContents.id));
                    popup.webContents.setWindowOpenHandler(this.denyNewWindow);
                    popup.once('closed', () => {
                        this.popupWindow = undefined;
                    });

                    const contextMenu = new ContextMenu({}, popup);
                    contextMenu.reload();
                }

                popup.once('ready-to-show', () => popup.show());

                if (urlUtils.isManagedResource(serverURL, parsedURL)) {
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

            const otherServerURL = WindowManager.viewManager?.getViewByURL(parsedURL);
            if (otherServerURL && urlUtils.isTeamUrl(otherServerURL.server.url, parsedURL, true)) {
                WindowManager.showMainWindow(parsedURL);
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

    addMattermostViewEventListeners = (mmview: MattermostView) => {
        this.addWebContentsEventListeners(
            mmview.view.webContents,
            (contents: WebContents) => {
                contents.on('page-title-updated', mmview.handleTitleUpdate);
                contents.on('page-favicon-updated', mmview.handleFaviconUpdate);
                contents.on('update-target-url', mmview.handleUpdateTarget);
                contents.on('did-navigate', mmview.handleDidNavigate);
            },
            (contents: WebContents) => {
                contents.removeListener('page-title-updated', mmview.handleTitleUpdate);
                contents.removeListener('page-favicon-updated', mmview.handleFaviconUpdate);
                contents.removeListener('update-target-url', mmview.handleUpdateTarget);
                contents.removeListener('did-navigate', mmview.handleDidNavigate);
            },
        );
    };

    addWebContentsEventListeners = (
        contents: WebContents,
        addListeners?: (contents: WebContents) => void,
        removeListeners?: (contents: WebContents) => void,
    ) => {
        // initialize custom login tracking
        this.customLogins[contents.id] = {
            inProgress: false,
        };

        if (this.listeners[contents.id]) {
            this.removeWebContentsListeners(contents.id);
        }

        const willNavigate = this.generateWillNavigate(contents.id);
        contents.on('will-navigate', willNavigate);

        // handle custom login requests (oath, saml):
        // 1. are we navigating to a supported local custom login path from the `/login` page?
        //    - indicate custom login is in progress
        // 2. are we finished with the custom login process?
        //    - indicate custom login is NOT in progress
        const didStartNavigation = this.generateDidStartNavigation(contents.id);
        contents.on('did-start-navigation', didStartNavigation);

        const spellcheck = Config.useSpellChecker;
        const newWindow = this.generateNewWindowListener(contents.id, spellcheck);
        contents.setWindowOpenHandler(newWindow);

        addListeners?.(contents);

        const removeWebContentsListeners = () => {
            try {
                contents.removeListener('will-navigate', willNavigate);
                contents.removeListener('did-start-navigation', didStartNavigation);
                removeListeners?.(contents);
            } catch (e) {
                log.error(`Error while trying to detach listeners, this might be ok if the process crashed: ${e}`);
            }
        };

        this.listeners[contents.id] = removeWebContentsListeners;
        contents.once('render-process-gone', (event, details) => {
            if (details.reason !== 'clean-exit') {
                log.error('Renderer process for a webcontent is no longer available:', details.reason);
            }
            removeWebContentsListeners();
        });
    };
}

const webContentsEventManager = new WebContentsEventManager();
export default webContentsEventManager;
