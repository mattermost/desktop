// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

/* eslint-disable no-magic-numbers */

import {contextBridge, ipcRenderer, webFrame} from 'electron';

// I've filed an issue in electron-log https://github.com/megahertz/electron-log/issues/267
// we'll be able to use it again if there is a workaround for the 'os' import
//import log from 'electron-log';

import {
    NOTIFY_MENTION,
    IS_UNREAD,
    UNREAD_RESULT,
    SESSION_EXPIRED,
    SET_VIEW_OPTIONS,
    REACT_APP_INITIALIZED,
    USER_ACTIVITY_UPDATE,
    CLOSE_TEAMS_DROPDOWN,
    BROWSER_HISTORY_BUTTON,
    BROWSER_HISTORY_PUSH,
    APP_LOGGED_IN,
    APP_LOGGED_OUT,
    GET_VIEW_NAME,
    GET_VIEW_WEBCONTENTS_ID,
    DISPATCH_GET_DESKTOP_SOURCES,
    DESKTOP_SOURCES_RESULT,
    VIEW_FINISHED_RESIZING,
    CLOSE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

const UNREAD_COUNT_INTERVAL = 1000;
const CLEAR_CACHE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

let appVersion;
let appName;
let sessionExpired;
let viewName;
let shouldSendNotifications;

console.log('Preload initialized');

if (process.env.NODE_ENV === 'test') {
    contextBridge.exposeInMainWorld('testHelper', {
        getViewName: () => ipcRenderer.invoke(GET_VIEW_NAME),
        getWebContentsId: () => ipcRenderer.invoke(GET_VIEW_WEBCONTENTS_ID),
    });
}

ipcRenderer.invoke('get-app-version').then(({name, version}) => {
    appVersion = version;
    appName = name;
});

function isReactAppInitialized() {
    const initializedRoot =
    document.querySelector('#root.channel-view') || // React 16 webapp
    document.querySelector('#root .signup-team__container') || // React 16 login
    document.querySelector('div[data-reactroot]'); // Older React apps
    if (initializedRoot === null) {
        return false;
    }
    return initializedRoot.children.length !== 0;
}

function watchReactAppUntilInitialized(callback) {
    let count = 0;
    const interval = 500;
    const timeout = 30000;
    const timer = setInterval(() => {
        count += interval;
        if (isReactAppInitialized() || count >= timeout) { // assumed as webapp has been initialized.
            clearTimeout(timer);
            callback();
        }
    }, interval);
}

window.addEventListener('load', () => {
    if (document.getElementById('root') === null) {
        console.log('The guest is not assumed as mattermost-webapp');
        return;
    }
    watchReactAppUntilInitialized(() => {
        ipcRenderer.send(REACT_APP_INITIALIZED, viewName);
        ipcRenderer.send(BROWSER_HISTORY_BUTTON, viewName);
    });
});

const parentTag = (target) => {
    if (target.parentNode && target.parentNode.tagName) {
        return target.parentNode.tagName.toUpperCase();
    }
    return null;
};

document.addEventListener('mouseover', (event) => {
    if (event.target && (event.target.tagName === 'A')) {
        ipcRenderer.send('update-target-url', event.target.href);
    } else if (event.target && (parentTag(event.target) === 'A')) {
        ipcRenderer.send('update-target-url', event.target.parentNode.href);
    }
});

document.addEventListener('mouseout', (event) => {
    if (event.target && event.target.tagName === 'A') {
        ipcRenderer.send('delete-target-url', event.target.href);
    }
});

// listen for messages from the webapp
window.addEventListener('message', ({origin, data = {}} = {}) => {
    const {type, message = {}} = data;
    if (origin !== window.location.origin) {
        return;
    }
    switch (type) {
    case 'webapp-ready': {
    // register with the webapp to enable custom integration functionality
        console.log(`registering ${appName} v${appVersion} with the server`);
        window.postMessage(
            {
                type: 'register-desktop',
                message: {
                    version: appVersion,
                    name: appName,
                },
            },
            window.location.origin || '*',
        );
        break;
    }
    case 'register-desktop':
    // it will be captured by itself too
        break;
    case 'dispatch-notification': {
        if (shouldSendNotifications) {
            const {title, body, channel, teamId, url, silent, data: messageData} = message;
            ipcRenderer.send(NOTIFY_MENTION, title, body, channel, teamId, url, silent, messageData);
        }
        break;
    }
    case 'browser-history-push': {
        const {path} = message;
        ipcRenderer.send(BROWSER_HISTORY_PUSH, viewName, path);
        break;
    }
    case 'history-button': {
        ipcRenderer.send(BROWSER_HISTORY_BUTTON, viewName);
        break;
    }
    case 'get-desktop-sources': {
        ipcRenderer.send(DISPATCH_GET_DESKTOP_SOURCES, viewName, message);
        break;
    }
    }
});

const handleNotificationClick = ({channel, teamId, url}) => {
    window.postMessage(
        {
            type: 'notification-clicked',
            message: {
                channel,
                teamId,
                url,
            },
        },
        window.location.origin,
    );
};

ipcRenderer.on('notification-clicked', (event, data) => {
    handleNotificationClick(data);
});

const findUnread = (favicon) => {
    const classes = ['team-container unread', 'SidebarChannel unread', 'sidebar-item unread-title'];
    const isUnread = classes.some((classPair) => {
        const result = document.getElementsByClassName(classPair);
        return result && result.length > 0;
    });
    ipcRenderer.send(UNREAD_RESULT, favicon, viewName, isUnread);
};

ipcRenderer.on(IS_UNREAD, (event, favicon, server) => {
    if (typeof viewName === 'undefined') {
        viewName = server;
    }
    if (isReactAppInitialized()) {
        findUnread(favicon);
    } else {
        watchReactAppUntilInitialized(() => {
            findUnread(favicon);
        });
    }
});

ipcRenderer.on(SET_VIEW_OPTIONS, (_, name, shouldNotify) => {
    viewName = name;
    shouldSendNotifications = shouldNotify;
});

function getUnreadCount() {
    // LHS not found => Log out => Count should be 0, but session may be expired.
    if (typeof viewName !== 'undefined') {
        let isExpired;
        if (document.getElementById('sidebar-left') === null) {
            const extraParam = (new URLSearchParams(window.location.search)).get('extra');
            isExpired = extraParam === 'expired';
        } else {
            isExpired = false;
        }
        if (isExpired !== sessionExpired) {
            sessionExpired = isExpired;
            ipcRenderer.send(SESSION_EXPIRED, sessionExpired, viewName);
        }
    }
}
setInterval(getUnreadCount, UNREAD_COUNT_INTERVAL);

// push user activity updates to the webapp
ipcRenderer.on(USER_ACTIVITY_UPDATE, (event, {userIsActive, isSystemEvent}) => {
    if (window.location.origin !== 'null') {
        window.postMessage({type: USER_ACTIVITY_UPDATE, message: {userIsActive, manual: isSystemEvent}}, window.location.origin);
    }
});

// exit fullscreen embedded elements like youtube - https://mattermost.atlassian.net/browse/MM-19226
ipcRenderer.on('exit-fullscreen', () => {
    if (document.fullscreenElement && document.fullscreenElement.nodeName.toLowerCase() === 'iframe') {
        document.exitFullscreen();
    }
});

// mattermost-webapp is SPA. So cache is not cleared due to no navigation.
// We needed to manually clear cache to free memory in long-term-use.
// http://seenaburns.com/debugging-electron-memory-usage/
setInterval(() => {
    webFrame.clearCache();
}, CLEAR_CACHE_INTERVAL);

function isDownloadLink(el) {
    if (typeof el !== 'object') {
        return false;
    }
    const parentEl = el.parentElement;
    if (typeof parentEl !== 'object') {
        return el.className?.includes?.('download') || el.tagName?.toLowerCase?.() === 'svg';
    }
    return el.closest('a[download]') !== null;
}

window.addEventListener('click', (e) => {
    ipcRenderer.send(CLOSE_TEAMS_DROPDOWN);
    const el = e.target;
    if (!isDownloadLink(el)) {
        ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN);
    }
});

ipcRenderer.on(BROWSER_HISTORY_PUSH, (event, pathName) => {
    window.postMessage(
        {
            type: 'browser-history-push-return',
            message: {
                pathName,
            },
        },
        window.location.origin,
    );
});

ipcRenderer.on(BROWSER_HISTORY_BUTTON, (event, enableBack, enableForward) => {
    window.postMessage(
        {
            type: 'history-button-return',
            message: {
                enableBack,
                enableForward,
            },
        },
        window.location.origin,
    );
});

window.addEventListener('storage', (e) => {
    if (e.key === '__login__' && e.storageArea === localStorage && e.newValue) {
        ipcRenderer.send(APP_LOGGED_IN, viewName);
    }
    if (e.key === '__logout__' && e.storageArea === localStorage && e.newValue) {
        ipcRenderer.send(APP_LOGGED_OUT, viewName);
    }
});

ipcRenderer.on(DESKTOP_SOURCES_RESULT, (event, sources) => {
    window.postMessage(
        {
            type: 'desktop-sources-result',
            message: sources,
        },
        window.location.origin,
    );
});

/* eslint-enable no-magic-numbers */

window.addEventListener('resize', () => {
    ipcRenderer.send(VIEW_FINISHED_RESIZING);
});
