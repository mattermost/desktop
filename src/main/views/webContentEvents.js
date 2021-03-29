// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow, shell} from 'electron';
import log from 'electron-log';

import {DEVELOPMENT, PRODUCTION} from 'common/utils/constants';
import urlUtils from 'common/utils/url';
import Utils from 'common/utils/util';
import {FOUND_IN_PAGE} from 'common/communication';

import * as WindowManager from '../windows/windowManager';

import {protocols} from '../../../electron-builder.json';

import allowProtocolDialog from '../allowProtocolDialog';

const customLogins = {};
const listeners = {};
let popupWindow = null;

function isTrustedPopupWindow(webContents) {
    if (!webContents) {
        return false;
    }
    if (!popupWindow) {
        return false;
    }
    return Utils.browserWindowFromWebContents(webContents) === popupWindow;
}

const nixUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36';

const popupUserAgent = {
    darwin: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
    win32: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
    aix: nixUA,
    freebsd: nixUA,
    linux: nixUA,
    openbsd: nixUA,
    sunos: nixUA,
};

const scheme = protocols && protocols[0] && protocols[0].schemes && protocols[0].schemes[0];

const generateWillNavigate = (getServersFunction) => {
    return (event, url) => {
        const contentID = event.sender.id;
        const parsedURL = urlUtils.parseURL(url);
        const configServers = getServersFunction();
        const server = urlUtils.getServer(parsedURL, configServers);

        if (server && (urlUtils.isTeamUrl(server.url, parsedURL) || urlUtils.isAdminUrl(server.url, parsedURL) || isTrustedPopupWindow(event.sender))) {
            return;
        }

        if (urlUtils.isCustomLoginURL(parsedURL, server, configServers)) {
            return;
        }
        if (parsedURL.protocol === 'mailto:') {
            return;
        }
        if (customLogins[contentID].inProgress) {
            return;
        }
        const mode = Utils.runMode();
        if (((mode === DEVELOPMENT || mode === PRODUCTION) &&
        (parsedURL.path === 'renderer/index.html' || parsedURL.path === 'renderer/settings.html'))) {
            log.info('loading settings page');
            return;
        }

        log.info(`Prevented desktop from navigating to: ${url}`);
        event.preventDefault();
    };
};

const generateDidStartNavigation = (getServersFunction) => {
    return (event, url) => {
        const serverList = getServersFunction();
        const contentID = event.sender.id;
        const parsedURL = urlUtils.parseURL(url);
        const server = urlUtils.getServer(parsedURL, serverList);

        if (!urlUtils.isTrustedURL(parsedURL, serverList)) {
            return;
        }

        if (urlUtils.isCustomLoginURL(parsedURL, server, serverList)) {
            customLogins[contentID].inProgress = true;
        } else if (customLogins[contentID].inProgress) {
            customLogins[contentID].inProgress = false;
        }
    };
};

const generateNewWindowListener = (getServersFunction, spellcheck) => {
    return (event, url) => {
        const parsedURL = urlUtils.parseURL(url);
        if (!parsedURL) {
            event.preventDefault();
            log.warn(`Ignoring non-url ${url}`);
            return;
        }

        const configServers = getServersFunction();

        // Dev tools case
        if (parsedURL.protocol === 'devtools:') {
            return;
        }
        event.preventDefault();

        // Check for valid URL
        if (!urlUtils.isValidURI(url)) {
            return;
        }

        // Check for custom protocol
        if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:' && parsedURL.protocol !== `${scheme}:`) {
            allowProtocolDialog.handleDialogEvent(parsedURL.protocol, url);
            return;
        }

        const server = urlUtils.getServer(parsedURL, configServers);

        if (!server) {
            shell.openExternal(url);
            return;
        }

        // Public download links case
        // TODO: We might be handling different types differently in the future, for now
        // we are going to mimic the browser and just pop a new browser window for public links
        if (parsedURL.pathname.match(/^(\/api\/v[3-4]\/public)*\/files\//)) {
            shell.openExternal(url);
            return;
        }

        if (parsedURL.pathname.match(/^\/help\//)) {
            // Help links case
            // continue to open special case internal urls in default browser
            shell.openExternal(url);
            return;
        }

        if (urlUtils.isTeamUrl(server.url, parsedURL, true)) {
            WindowManager.showMainWindow(parsedURL);
            return;
        }
        if (urlUtils.isAdminUrl(server.url, parsedURL)) {
            log.info(`${url} is an admin console page, preventing to open a new window`);
            return;
        }
        if (popupWindow && !popupWindow.closed && popupWindow.getURL() === url) {
            log.info(`Popup window already open at provided url: ${url}`);
            return;
        }

        // TODO: move popups to its own and have more than one.
        if (urlUtils.isPluginUrl(server.url, parsedURL) || urlUtils.isManagedResource(server.url, parsedURL)) {
            if (!popupWindow || popupWindow.closed) {
                popupWindow = new BrowserWindow({
                    backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
                    //parent: WindowManager.getMainWindow(),
                    show: false,
                    center: true,
                    webPreferences: {
                        nodeIntegration: process.env.NODE_ENV === 'test',
                        contextIsolation: process.env.NODE_ENV !== 'test',
                        spellcheck: (typeof spellcheck === 'undefined' ? true : spellcheck),
                        enableRemoteModule: process.env.NODE_ENV === 'test',
                    },
                });
                popupWindow.once('ready-to-show', () => {
                    popupWindow.show();
                });
                popupWindow.once('closed', () => {
                    popupWindow = null;
                });
            }

            if (urlUtils.isManagedResource(server.url, parsedURL)) {
                popupWindow.loadURL(url);
            } else {
                // currently changing the userAgent for popup windows to allow plugins to go through google's oAuth
                // should be removed once a proper oAuth2 implementation is setup.
                popupWindow.loadURL(url, {
                    userAgent: popupUserAgent[process.platform],
                });
            }
        }
    };
};

export const removeWebContentsListeners = (id) => {
    if (listeners[id]) {
        listeners[id]();
    }
};

export const addWebContentsEventListeners = (mmview, getServersFunction) => {
    const contents = mmview.view.webContents;

    // initialize custom login tracking
    customLogins[contents.id] = {
        inProgress: false,
    };

    if (listeners[contents.id]) {
        removeWebContentsListeners(contents.id);
    }
    const willNavigate = generateWillNavigate(getServersFunction);
    contents.on('will-navigate', willNavigate);

    // handle custom login requests (oath, saml):
    // 1. are we navigating to a supported local custom login path from the `/login` page?
    //    - indicate custom login is in progress
    // 2. are we finished with the custom login process?
    //    - indicate custom login is NOT in progress
    const didStartNavigation = generateDidStartNavigation(getServersFunction);
    contents.on('did-start-navigation', didStartNavigation);

    const spellcheck = mmview.options.webPreferences.spellcheck;
    const newWindow = generateNewWindowListener(getServersFunction, spellcheck);
    contents.on('new-window', newWindow);

    contents.on('page-title-updated', mmview.handleTitleUpdate);
    contents.on('page-favicon-updated', mmview.handleFaviconUpdate);
    contents.on('update-target-url', mmview.handleUpdateTarget);
    contents.on(FOUND_IN_PAGE, mmview.handleFoundInPage);
    contents.on('did-navigate', mmview.handleDidNavigate);

    const removeListeners = () => {
        try {
            contents.removeListener('will-navigate', willNavigate);
            contents.removeListener('did-start-navigation', didStartNavigation);
            contents.removeListener('new-window', newWindow);
            contents.removeListener('page-title-updated', mmview.handleTitleUpdate);
            contents.removeListener('page-favicon-updated', mmview.handleFaviconUpdate);
            contents.removeListener('update-target-url', mmview.handleUpdateTarget);
            contents.removeListener(FOUND_IN_PAGE, mmview.handleFoundInPage);
            contents.removeListener('did-navigate', mmview.handleDidNavigate);
        } catch (e) {
            log.error(`Error while trying to detach listeners, this might be ok if the process crashed: ${e}`);
        }
    };

    listeners[contents.id] = removeListeners;
    contents.once('render-process-gone', (event, details) => {
        if (details.reason !== 'clean-exit') {
            log.error('Renderer process for a webcontent is no longer available:', details.reason);
        }
        removeListeners();
    });
};
