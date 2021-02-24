// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';
import {BrowserView, BrowserWindow, dialog, shell} from 'electron';

import {SECOND, DEVELOPMENT, PRODUCTION} from 'common/utils/constants';
import {UPDATE_TARGET_URL, FOUND_IN_PAGE, SET_SERVER_KEY, LOAD_SUCCESS, LOAD_FAILED} from 'common/communication';
import urlUtils from 'common/utils/url';
import Utils from 'common/utils/util';

import {protocols} from '../../electron-builder.json';

import contextMenu from './contextMenu';
import {MattermostServer} from './MattermostServer';
import {MattermostView} from './MattermostView';
import {getLocalURLString, getLocalPreload} from './utils';
import {showModal} from './modalManager';
import allowProtocolDialog from './allowProtocolDialog';

const URL_VIEW_DURATION = 10 * SECOND;
const URL_VIEW_HEIGHT = 36;
const FINDER_WIDTH = 310;
const FINDER_HEIGHT = 40;

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

export class ViewManager {
    constructor(config) {
        this.configServers = config.teams;
        this.viewOptions = {spellcheck: config.useSpellChecker};
        this.views = new Map(); // keep in mind that this doesn't need to hold server order, only tabs on the renderer need that.
        this.currentView = null;
        this.urlView = null;

        // tracking in progress custom logins
        this.customLogins = {};

        // hold listener removal functions
        this.listeners = {};

        this.popupWindow = null;
    }

    // temporarily added here

    isTrustedPopupWindow = (webContents) => {
        if (!webContents) {
            return false;
        }
        if (!this.popupWindow) {
            return false;
        }
        return BrowserWindow.fromWebContents(webContents) === this.popupWindow;
    }

    willNavigate = (_event, url) => {
        const contentID = event.sender.id;
        const parsedURL = urlUtils.parseURL(url);
        const server = urlUtils.getServer(parsedURL, this.configServers);

        if (server && (urlUtils.isTeamUrl(server.url, parsedURL) || urlUtils.isAdminUrl(server.url, parsedURL) || this.isTrustedPopupWindow(event.sender))) {
            return;
        }

        if (urlUtils.isCustomLoginURL(parsedURL, server, this.configServers)) {
            return;
        }
        if (parsedURL.protocol === 'mailto:') {
            return;
        }
        if (this.customLogins[contentID].inProgress) {
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

    didStartNavigation = (event, url) => {
        const contentID = event.sender.id;
        const parsedURL = urlUtils.parseURL(url);
        const server = urlUtils.getServer(parsedURL, this.configServers);

        if (!urlUtils.isTrustedURL(parsedURL, this.configServers)) {
            return;
        }

        if (urlUtils.isCustomLoginURL(parsedURL, server, this.configServers)) {
            this.customLogins[contentID].inProgress = true;
        } else if (this.customLogins[contentID].inProgress) {
            this.customLogins[contentID].inProgress = false;
        }
    };

    newWindow = (event, url) => {
        const parsedURL = urlUtils.parseURL(url);

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

        const server = urlUtils.getServer(parsedURL, this.configServers);

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
            log.info(`${url} is a known team, preventing to open a new window`);
            return;
        }
        if (urlUtils.isAdminUrl(server.url, parsedURL)) {
            log.info(`${url} is an admin console page, preventing to open a new window`);
            return;
        }
        if (this.popupWindow && !this.popupWindow.closed && this.popupWindow.getURL() === url) {
            log.info(`Popup window already open at provided url: ${url}`);
            return;
        }

        // TODO: move popups to its own and have more than one.
        if (urlUtils.isPluginUrl(server.url, parsedURL) || urlUtils.isManagedResource(server.url, parsedURL)) {
            if (!this.popupWindow || this.popupWindow.closed) {
                this.popupWindow = new BrowserWindow({
                    backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
                    //parent: WindowManager.getMainWindow(),
                    show: false,
                    center: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        spellcheck: (typeof this.viewOptions.spellcheck === 'undefined' ? true : this.viewOptions.spellcheck),
                    },
                });
                this.popupWindow.once('ready-to-show', () => {
                    this.popupWindow.show();
                });
                this.popupWindow.once('closed', () => {
                    this.popupWindow = null;
                });
            }

            if (urlUtils.isManagedResource(server.url, parsedURL)) {
                this.popupWindow.loadURL(url);
            } else {
                // currently changing the userAgent for popup windows to allow plugins to go through google's oAuth
                // should be removed once a proper oAuth2 implementation is setup.
                this.popupWindow.loadURL(url, {
                    userAgent: popupUserAgent[process.platform],
                });
            }
        }
    };

    removeWebContentsListeners = (id) => {
        if (this.listeners[id]) {
            this.listeners[id]();
        }
    }

    handleAppWebContentsCreated = (contents) => {
        // initialize custom login tracking
        this.customLogins[contents.id] = {
            inProgress: false,
        };

        if (this.listeners[contents.id]) {
            this.removeWebContentsListeners(contents.id);
        }

        contents.on('will-navigate', this.willNavigate);

        // handle custom login requests (oath, saml):
        // 1. are we navigating to a supported local custom login path from the `/login` page?
        //    - indicate custom login is in progress
        // 2. are we finished with the custom login process?
        //    - indicate custom login is NOT in progress
        contents.on('did-start-navigation', this.didStartNavigation);

        contents.on('new-window', this.newWindow);

        const removeListeners = () => {
            try {
                contents.removeListener('will-navigate', this.willNavigate);
                contents.removeListener('did-start-navigation', this.didStartNavigation);
                contents.removeListener('new-window', this.newWindow);
            } catch (e) {
                log.error(`Error while trying to detach listeners, this might be ok if the process crashed: ${e}`);
            }
        };

        this.listeners[contents.id] = removeListeners;
        contents.once('render-process-gone', (event, details) => {
            if (details !== 'clean-exit') {
                log.error(`Renderer process for a webcontent is no longer available: ${details}`);
            }
            removeListeners();
        });
    }

    // end of temporarily added here

    loadServer = (server, mainWindow) => {
        const srv = new MattermostServer(server.name, server.url);
        const view = new MattermostView(srv, mainWindow, this.viewOptions);
        this.views.set(server.name, view);
        view.once(LOAD_SUCCESS, this.activateView);
        view.load();
        view.on(UPDATE_TARGET_URL, this.showURLView);
    }

    // TODO: we shouldn't pass the main window, but get it from windowmanager
    // TODO: we'll need an event in case the main window changes so this updates accordingly
    load = (mainWindow) => {
        this.configServers.forEach((server) => this.loadServer(server, mainWindow));
    }

    reloadConfiguration = (configServers, mainWindow) => {
        this.configServers = configServers.concat();
        const oldviews = this.views;
        this.views = new Map();
        const sorted = this.configServers.sort((a, b) => a.order - b.order);
        let setFocus;
        sorted.forEach((server) => {
            const recycle = oldviews.get(server.name);
            if (recycle && recycle.isVisible) {
                setFocus = recycle.name;
            }
            if (recycle && recycle.server.url.toString() === urlUtils.parseURL(server.url).toString()) {
                oldviews.delete(recycle.name);
                this.views.set(recycle.name, recycle);
            } else {
                this.loadServer(server, mainWindow);
            }
        });
        oldviews.forEach((unused) => {
            unused.destroy();
        });
        if (setFocus) {
            this.showByName(setFocus);
        } else {
            this.showInitial();
        }
    }

    showInitial = () => {
        if (this.configServers.length) {
            const element = this.configServers.find((e) => e.order === 0);
            if (element) {
                this.showByName(element.name);
            }
        }
    }

    showByName = (name) => {
        const newView = this.views.get(name);
        if (newView.isVisible) {
            return;
        }
        if (newView) {
            if (this.currentView && this.currentView !== name) {
                const previous = this.getCurrentView();
                if (previous) {
                    previous.hide();
                }
            }

            this.currentView = name;
            const serverInfo = this.configServers.find((candidate) => candidate.name === newView.server.name);
            newView.window.webContents.send(SET_SERVER_KEY, serverInfo.order);
            if (newView.isReady()) {
                // if view is not ready, the renderer will have something to display instead.
                newView.show();
                contextMenu.reload(newView.getWebContents());
            } else {
                log.warn(`couldn't show ${name}, not ready`);
            }
        } else {
            log.warn(`Couldn't find a view with name: ${name}`);
        }
        showModal();
    }

    focus = () => {
        const view = this.getCurrentView();
        if (view) {
            view.focus();
        }
    }
    activateView = (viewName) => {
        if (this.currentView === viewName) {
            this.showByName(this.currentView);
        }
        const view = this.views.get(viewName);
        this.handleAppWebContentsCreated(view.view.webContents);
    }

    getCurrentView() {
        return this.views.get(this.currentView);
    }

    openViewDevTools = () => {
        const view = this.getCurrentView();
        if (view) {
            view.openDevTools({mode: 'detach'});
        } else {
            log.error(`couldn't find ${this.currentView}`);
        }
    }

    findByWebContent(webContentId) {
        let found = null;
        let serverName;
        let view;
        const entries = this.views.entries();

        for ([serverName, view] of entries) {
            if (typeof serverName !== 'undefined') {
                const wc = view.getWebContents();
                if (wc && wc.id === webContentId) {
                    found = serverName;
                }
            }
        }
        return found;
    }

    showURLView = (url) => {
        if (this.urlViewCancel) {
            this.urlViewCancel();
        }
        if (url && url !== '') {
            const urlString = typeof url === 'string' ? url : url.toString();
            const urlView = new BrowserView();
            const query = new Map([['url', urlString]]);
            const localURL = getLocalURLString('urlView.html', query);
            urlView.webContents.loadURL(localURL);
            const currentWindow = this.getCurrentView().window;
            currentWindow.addBrowserView(urlView);
            const boundaries = currentWindow.getBounds();
            urlView.setBounds({
                x: 0,
                y: boundaries.height - URL_VIEW_HEIGHT,
                width: Math.floor(boundaries.width / 3),
                height: URL_VIEW_HEIGHT,
            });

            const hideView = () => {
                this.urlViewCancel = null;
                currentWindow.removeBrowserView(urlView);
                urlView.destroy();
            };

            const timeout = setTimeout(hideView,
                URL_VIEW_DURATION);

            this.urlViewCancel = () => {
                clearTimeout(timeout);
                hideView();
            };
        }
    }

    setFinderBounds = () => {
        if (this.finder) {
            const currentWindow = this.getCurrentView().window;
            const boundaries = currentWindow.getBounds();
            this.finder.setBounds({
                x: boundaries.width - FINDER_WIDTH - (process.platform === 'darwin' ? 20 : 200),
                y: 0,
                width: FINDER_WIDTH,
                height: FINDER_HEIGHT,
            });
        }
    }

    focusFinder = () => {
        if (this.finder) {
            this.finder.webContents.focus();
        }
    }

    hideFinder = () => {
        if (this.finder) {
            const currentWindow = this.getCurrentView().window;
            currentWindow.removeBrowserView(this.finder);
            this.finder.destroy();
            this.finder = null;
        }
    }

    foundInPage = (result) => {
        if (this.finder) {
            this.finder.webContents.send(FOUND_IN_PAGE, result);
        }
    };

    showFinder = () => {
        // just focus the current finder if it's already open
        if (this.finder) {
            this.finder.webContents.focus();
            return;
        }

        const preload = getLocalPreload('finderPreload.js');
        this.finder = new BrowserView({webPreferences: {
            preload,
        }});
        const localURL = getLocalURLString('finder.html');
        this.finder.webContents.loadURL(localURL);
        const currentWindow = this.getCurrentView().window;
        currentWindow.addBrowserView(this.finder);
        this.setFinderBounds();

        this.finder.webContents.focus();
    };

    deeplinkSuccess = (serverName) => {
        const view = this.views.get(serverName);
        this.showByName(serverName);
        view.removeListener(LOAD_FAILED, this.deeplinkFailed);
    };

    deeplinkFailed = (serverName, err, url) => {
        const view = this.views.get(serverName);
        log.error(`[${serverName}] failed to load deeplink ${url}: ${err}`);
        view.removeListener(LOAD_SUCCESS, this.deeplinkSuccess);
    }

    handleDeepLink = (url) => {
        if (url) {
            const parsedURL = urlUtils.parseURL(url);
            const server = urlUtils.getServer(parsedURL, this.configServers, true);
            if (server) {
                const view = this.views.get(server.name);

                // attempting to change parsedURL protocol results in it not being modified.
                const urlWithSchema = `${view.server.url.origin}${parsedURL.pathname}${parsedURL.search}`;
                view.resetLoadingStatus();
                view.load(urlWithSchema);
                view.once(LOAD_SUCCESS, this.deeplinkSuccess);
                view.once(LOAD_FAILED, this.deeplinkFailed);
            } else {
                dialog.showErrorBox('No matching server', `there is no configured server in the app that matches the requested url: ${parsedURL.toString()}`);
            }
        }
    };
}
