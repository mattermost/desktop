// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const customLogins = [];
const listeners = [];
let popupWindow;

function isTrustedPopupWindow(webContents) {
    if (!webContents) {
        return false;
    }
    if (!popupWindow) {
        return false;
    }
    return BrowserWindow.fromWebContents(webContents) === popupWindow;
}

const willNavigate = (_event, url) => {
    const contentID = event.sender.id;
    const parsedURL = urlUtils.parseURL(url);
    const server = urlUtils.getServer(parsedURL, config.teams);

    if (server && (urlUtils.isTeamUrl(server.url, parsedURL) || urlUtils.isAdminUrl(server.url, parsedURL) || isTrustedPopupWindow(event.sender))) {
        return;
    }

    if (urlUtils.isCustomLoginURL(parsedURL, server, config.teams)) {
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

const didStartNavigation = (event, url) => {
    const contentID = event.sender.id;
    const parsedURL = urlUtils.parseURL(url);
    const server = urlUtils.getServer(parsedURL, config.teams);

    if (!urlUtils.isTrustedURL(parsedURL, config.teams)) {
        return;
    }

    if (urlUtils.isCustomLoginURL(parsedURL, server, config.teams)) {
        customLogins[contentID].inProgress = true;
    } else if (customLogins[contentID].inProgress) {
        customLogins[contentID].inProgress = false;
    }
};

const newWindow = (event, url) => {
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

    const server = urlUtils.getServer(parsedURL, config.teams);

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
    if (popupWindow && !popupWindow.closed && popupWindow.getURL() === url) {
        log.info(`Popup window already open at provided url: ${url}`);
        return;
    }

    // TODO: move popups to its own and have more than one.
    if (urlUtils.isPluginUrl(server.url, parsedURL) || urlUtils.isManagedResource(server.url, parsedURL)) {
        if (!popupWindow || popupWindow.closed) {
            popupWindow = new BrowserWindow({
                backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
                parent: WindowManager.getMainWindow(),
                show: false,
                center: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    spellcheck: (typeof config.useSpellChecker === 'undefined' ? true : config.useSpellChecker),
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

export function removeWebContentsListeners(id) {
    if (listeners[id]) {
        listeners[id]();
    } else {
        log.warn(`There wasn't any function to remove the listener for webContents#${id}`);
    }
}

export function handleAppWebContentsCreated(contents) {
    // initialize custom login tracking
    customLogins[contents.id] = {
        inProgress: false,
    };

    contents.on('will-navigate', willNavigate);

    // handle custom login requests (oath, saml):
    // 1. are we navigating to a supported local custom login path from the `/login` page?
    //    - indicate custom login is in progress
    // 2. are we finished with the custom login process?
    //    - indicate custom login is NOT in progress
    contents.on('did-start-navigation', didStartNavigation);

    contents.on('new-window', newWindow);

    const removeListeners = () => {
        try {
            contents.removeListener('will-navigate', willNavigate);
            contents.removeListener('did-start-navigation', didStartNavigation);
            contents.removeListener('new-window', newWindow);
        } catch (e) {
            log.error(`Error while trying to detach listeners, this might be ok if the process crashed: ${e}`);
        }
    };

    listeners[contents.id] = removeListeners;
    contents.once('render-process-gone', (event, details) => {
        if (details !== 'clean-exit') {
            log.error(`Renderer process for a webcontent is no longer available: ${details}`);
        }
        removeListeners();
    });

}