// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, shell, WebContents} from 'electron';
import log from 'electron-log';

import {TeamWithTabs} from 'types/config';

import Config from 'common/config';
import urlUtils from 'common/utils/url';

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
    popupWindow?: BrowserWindow;

    constructor() {
        this.customLogins = {};
        this.listeners = {};
    }

    isTrustedPopupWindow = (webContents: WebContents) => {
        if (!webContents) {
            return false;
        }
        if (!this.popupWindow) {
            return false;
        }
        return BrowserWindow.fromWebContents(webContents) === this.popupWindow;
    }

    generateWillNavigate = (getServersFunction: () => TeamWithTabs[]) => {
        return (event: Event & {sender: WebContents}, url: string) => {
            log.debug('webContentEvents.will-navigate', {webContentsId: event.sender.id, url});

            const contentID = event.sender.id;
            const parsedURL = urlUtils.parseURL(url)!;
            const configServers = getServersFunction();
            const server = urlUtils.getView(parsedURL, configServers);

            if (server && (urlUtils.isTeamUrl(server.url, parsedURL) || urlUtils.isAdminUrl(server.url, parsedURL) || this.isTrustedPopupWindow(event.sender))) {
                return;
            }

            if (server && urlUtils.isChannelExportUrl(server.url, parsedURL)) {
                return;
            }

            if (server && urlUtils.isCustomLoginURL(parsedURL, server, configServers)) {
                return;
            }
            if (parsedURL.protocol === 'mailto:') {
                return;
            }
            if (this.customLogins[contentID]?.inProgress) {
                return;
            }

            log.info(`Prevented desktop from navigating to: ${url}`);
            event.preventDefault();
        };
    };

    generateDidStartNavigation = (getServersFunction: () => TeamWithTabs[]) => {
        return (event: Event & {sender: WebContents}, url: string) => {
            log.debug('webContentEvents.did-start-navigation', {webContentsId: event.sender.id, url});

            const serverList = getServersFunction();
            const contentID = event.sender.id;
            const parsedURL = urlUtils.parseURL(url)!;
            const server = urlUtils.getView(parsedURL, serverList);

            if (!urlUtils.isTrustedURL(parsedURL, serverList)) {
                return;
            }

            const serverURL = urlUtils.parseURL(server?.url || '');

            if (server && urlUtils.isCustomLoginURL(parsedURL, server, serverList)) {
                this.customLogins[contentID].inProgress = true;
            } else if (server && this.customLogins[contentID].inProgress && urlUtils.isInternalURL(serverURL || new URL(''), parsedURL)) {
                this.customLogins[contentID].inProgress = false;
            }
        };
    };

    denyNewWindow = (details: Electron.HandlerDetails): {action: 'deny' | 'allow'} => {
        log.warn(`Prevented popup window to open a new window to ${details.url}.`);
        return {action: 'deny'};
    };

    generateNewWindowListener = (getServersFunction: () => TeamWithTabs[], spellcheck?: boolean) => {
        return (details: Electron.HandlerDetails): {action: 'deny' | 'allow'} => {
            log.debug('webContentEvents.new-window', details.url);

            const parsedURL = urlUtils.parseURL(details.url);
            if (!parsedURL) {
                log.warn(`Ignoring non-url ${details.url}`);
                return {action: 'deny'};
            }

            const configServers = getServersFunction();

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

            const server = urlUtils.getView(parsedURL, configServers);

            if (!server) {
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

            if (urlUtils.isTeamUrl(server.url, parsedURL, true)) {
                WindowManager.showMainWindow(parsedURL);
                return {action: 'deny'};
            }
            if (urlUtils.isAdminUrl(server.url, parsedURL)) {
                log.info(`${details.url} is an admin console page, preventing to open a new window`);
                return {action: 'deny'};
            }
            if (this.popupWindow && this.popupWindow.webContents.getURL() === details.url) {
                log.info(`Popup window already open at provided url: ${details.url}`);
                return {action: 'deny'};
            }

            // TODO: move popups to its own and have more than one.
            if (urlUtils.isPluginUrl(server.url, parsedURL) || urlUtils.isManagedResource(server.url, parsedURL)) {
                if (!this.popupWindow) {
                    this.popupWindow = new BrowserWindow({
                        backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
                        //parent: WindowManager.getMainWindow(),
                        show: false,
                        center: true,
                        webPreferences: {
                            spellcheck: (typeof spellcheck === 'undefined' ? true : spellcheck),
                        },
                    });
                    this.popupWindow.webContents.setWindowOpenHandler(this.denyNewWindow);
                    this.popupWindow.once('ready-to-show', () => {
                        this.popupWindow!.show();
                    });
                    this.popupWindow.once('closed', () => {
                        this.popupWindow = undefined;
                    });
                }

                if (urlUtils.isManagedResource(server.url, parsedURL)) {
                    this.popupWindow.loadURL(details.url);
                } else {
                    // currently changing the userAgent for popup windows to allow plugins to go through google's oAuth
                    // should be removed once a proper oAuth2 implementation is setup.
                    this.popupWindow.loadURL(details.url, {
                        userAgent: composeUserAgent(),
                    });
                }

                const contextMenu = new ContextMenu({}, this.popupWindow);
                contextMenu.reload();
            }

            return {action: 'deny'};
        };
    };

    removeWebContentsListeners = (id: number) => {
        if (this.listeners[id]) {
            this.listeners[id]();
        }
    };

    addMattermostViewEventListeners = (mmview: MattermostView, getServersFunction: () => TeamWithTabs[]) => {
        this.addWebContentsEventListeners(
            mmview.view.webContents,
            getServersFunction,
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
        getServersFunction: () => TeamWithTabs[],
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

        const willNavigate = this.generateWillNavigate(getServersFunction);
        contents.on('will-navigate', willNavigate as (e: Event, u: string) => void); // TODO: Electron types don't include sender for some reason

        // handle custom login requests (oath, saml):
        // 1. are we navigating to a supported local custom login path from the `/login` page?
        //    - indicate custom login is in progress
        // 2. are we finished with the custom login process?
        //    - indicate custom login is NOT in progress
        const didStartNavigation = this.generateDidStartNavigation(getServersFunction);
        contents.on('did-start-navigation', didStartNavigation as (e: Event, u: string) => void);

        const spellcheck = Config.useSpellChecker;
        const newWindow = this.generateNewWindowListener(getServersFunction, spellcheck);
        contents.setWindowOpenHandler(newWindow);

        addListeners?.(contents);

        const removeWebContentsListeners = () => {
            try {
                contents.removeListener('will-navigate', willNavigate as (e: Event, u: string) => void);
                contents.removeListener('did-start-navigation', didStartNavigation as (e: Event, u: string) => void);
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
