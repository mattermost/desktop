// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {contextBridge, ipcRenderer, webFrame} from 'electron';

import {
    NOTIFY_MENTION,
    IS_UNREAD,
    UNREAD_RESULT,
    SESSION_EXPIRED,
    REACT_APP_INITIALIZED,
    USER_ACTIVITY_UPDATE,
    BROWSER_HISTORY_PUSH,
    APP_LOGGED_IN,
    APP_LOGGED_OUT,
    GET_VIEW_INFO_FOR_TEST,
    DESKTOP_SOURCES_RESULT,
    VIEW_FINISHED_RESIZING,
    CALLS_JOIN_CALL,
    CALLS_JOINED_CALL,
    CALLS_LEAVE_CALL,
    DESKTOP_SOURCES_MODAL_REQUEST,
    CALLS_WIDGET_SHARE_SCREEN,
    CLOSE_DOWNLOADS_DROPDOWN,
    CALLS_ERROR,
    CALLS_JOIN_REQUEST,
    GET_IS_DEV_MODE,
    TOGGLE_SECURE_INPUT,
    GET_APP_INFO,
    REQUEST_BROWSER_HISTORY_STATUS,
    BROWSER_HISTORY_STATUS_UPDATED,
    NOTIFICATION_CLICKED,
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_CHANNEL_LINK_CLICK,
    CALLS_LINK_CLICK,
    CALLS_POPOUT_FOCUS,
    GET_DESKTOP_SOURCES,
} from 'common/communication';

contextBridge.exposeInMainWorld('desktopAPI', {

    // Initialization
    isDev: () => ipcRenderer.invoke(GET_IS_DEV_MODE),
    getAppInfo: () => ipcRenderer.invoke(GET_APP_INFO),
    reactAppInitialized: () => ipcRenderer.send(REACT_APP_INITIALIZED),

    // Session
    loggedIn: () => ipcRenderer.send(APP_LOGGED_IN),
    loggedOut: () => ipcRenderer.send(APP_LOGGED_OUT),
    setSessionExpired: (isExpired) => ipcRenderer.send(SESSION_EXPIRED, isExpired),
    onUserActivityUpdate: (listener) => ipcRenderer.on(USER_ACTIVITY_UPDATE, listener),

    // Unreads/mentions/notifications
    sendNotification: (title, body, channel, teamId, url, silent, messageData) =>
        ipcRenderer.send(NOTIFY_MENTION, title, body, channel, teamId, url, silent, messageData),
    onNotificationClicked: (listener) => ipcRenderer.on(NOTIFICATION_CLICKED, listener),
    updateUnread: (isUnread) => ipcRenderer.send(UNREAD_RESULT, isUnread),

    // Navigation
    requestBrowserHistoryStatus: () => ipcRenderer.invoke(REQUEST_BROWSER_HISTORY_STATUS),
    onBrowserHistoryStatusUpdated: (listener) => ipcRenderer.on(BROWSER_HISTORY_STATUS_UPDATED, listener),
    onBrowserHistoryPush: (listener) => ipcRenderer.on(BROWSER_HISTORY_PUSH, listener),

    // Calls widget
    openLinkFromCallsWidget: (url) => ipcRenderer.send(CALLS_LINK_CLICK, url),
    openScreenShareModal: () => ipcRenderer.send(DESKTOP_SOURCES_MODAL_REQUEST),
    onScreenShared: (listener) => ipcRenderer.on(CALLS_WIDGET_SHARE_SCREEN, listener),
    callsWidgetConnected: (callID) => ipcRenderer.send(CALLS_JOINED_CALL, callID),
    onJoinCallRequest: (listener) => ipcRenderer.on(CALLS_JOIN_REQUEST, listener),
    resizeCallsWidget: (width, height) => ipcRenderer.send(CALLS_WIDGET_RESIZE, width, height),
    focusPopout: () => ipcRenderer.send(CALLS_POPOUT_FOCUS),
    leaveCall: () => ipcRenderer.send(CALLS_LEAVE_CALL),
    sendCallsError: (error) => ipcRenderer.send(CALLS_ERROR, error),

    // Calls plugin
    getDesktopSources: (opts) => ipcRenderer.send(GET_DESKTOP_SOURCES, opts),
    onOpenScreenShareModal: (listener) => ipcRenderer.on(DESKTOP_SOURCES_MODAL_REQUEST, listener),
    shareScreen: (sourceID, withAudio) => ipcRenderer.send(CALLS_WIDGET_SHARE_SCREEN, sourceID, withAudio),
    joinCall: (opts) => ipcRenderer.invoke(CALLS_JOIN_CALL, opts),
    sendJoinCallRequest: (callId) => ipcRenderer.send(CALLS_JOIN_REQUEST, callId),
    onCallsError: (listener) => ipcRenderer.on(CALLS_ERROR, listener),

    // Utility
    unregister: (channel) => ipcRenderer.removeAllListeners(channel),
});

// Specific info for the testing environment
if (process.env.NODE_ENV === 'test') {
    contextBridge.exposeInMainWorld('testHelper', {
        getViewInfoForTest: () => ipcRenderer.invoke(GET_VIEW_INFO_FOR_TEST),
    });
}

/****************************************************************************
 * window/document listeners
 * These are here to perform specific tasks when global window events happen
 * TODO: Rework these if possible to avoid using them, have the control be in the Main Process
 ****************************************************************************
 */

// TODO: Can we just have the webapp tell us this?
window.addEventListener('click', (e) => {
    if (!isDownloadLink(e.target)) {
        ipcRenderer.send(CLOSE_DOWNLOADS_DROPDOWN);
    }
});

window.addEventListener('resize', () => {
    ipcRenderer.send(VIEW_FINISHED_RESIZING);
});

window.addEventListener('focusin', (event) => {
    shouldSecureInput(event.target);
});

window.addEventListener('focus', () => {
    shouldSecureInput(document.activeElement, true);
});

const isDownloadLink = (el) => {
    if (typeof el !== 'object') {
        return false;
    }
    const parentEl = el.parentElement;
    if (typeof parentEl !== 'object') {
        return el.className?.includes?.('download') || el.tagName?.toLowerCase?.() === 'svg';
    }
    return el.closest('a[download]') !== null;
};

let isPasswordBox = false;
const shouldSecureInput = (element, force = false) => {
    const targetIsPasswordBox = (element && element.tagName === 'INPUT' && element.type === 'password');
    if (targetIsPasswordBox && (!isPasswordBox || force)) {
        ipcRenderer.send(TOGGLE_SECURE_INPUT, true);
    } else if (!targetIsPasswordBox && (isPasswordBox || force)) {
        ipcRenderer.send(TOGGLE_SECURE_INPUT, false);
    }

    isPasswordBox = targetIsPasswordBox;
};

// exit fullscreen embedded elements like youtube - https://mattermost.atlassian.net/browse/MM-19226
ipcRenderer.on('exit-fullscreen', () => {
    if (document.fullscreenElement && document.fullscreenElement.nodeName.toLowerCase() === 'iframe') {
        document.exitFullscreen();
    }
});

// TODO: Do we still need this?
// mattermost-webapp is SPA. So cache is not cleared due to no navigation.
// We needed to manually clear cache to free memory in long-term-use.
// http://seenaburns.com/debugging-electron-memory-usage/
const CLEAR_CACHE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
setInterval(() => {
    webFrame.clearCache();
}, CLEAR_CACHE_INTERVAL);

/****************************************************************************
 * LEGACY CODE BELOW
 * All of this code is deprecated and should be removed eventually
 * Current it is there to support older versions of the web app
 ****************************************************************************
 */

const UNREAD_COUNT_INTERVAL = 1000;
let sessionExpired;

console.log('Preload initialized');

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
        ipcRenderer.send(REACT_APP_INITIALIZED);
        ipcRenderer.invoke(REQUEST_BROWSER_HISTORY_STATUS).then(sendHistoryButtonReturn);
    });
});

// listen for messages from the webapp
window.addEventListener('message', ({origin, data = {}} = {}) => {
    const {type, message = {}} = data;
    if (origin !== window.location.origin) {
        return;
    }
    switch (type) {
    case 'webapp-ready':
    case 'get-app-version': {
        // register with the webapp to enable custom integration functionality
        ipcRenderer.invoke(GET_APP_INFO).then((info) => {
            console.log(`registering ${info.name} v${info.version} with the server`);
            window.postMessage(
                {
                    type: 'register-desktop',
                    message: info,
                },
                window.location.origin || '*',
            );
        });
        break;
    }
    case 'dispatch-notification': {
        const {title, body, channel, teamId, url, silent, data: messageData} = message;
        ipcRenderer.send(NOTIFY_MENTION, title, body, channel, teamId, url, silent, messageData);
        break;
    }
    case BROWSER_HISTORY_PUSH: {
        const {path} = message;
        ipcRenderer.send(BROWSER_HISTORY_PUSH, path);
        break;
    }
    case 'history-button': {
        ipcRenderer.invoke(REQUEST_BROWSER_HISTORY_STATUS).then(sendHistoryButtonReturn);
        break;
    }
    case CALLS_LINK_CLICK: {
        ipcRenderer.send(CALLS_LINK_CLICK, message.link);
        break;
    }
    case GET_DESKTOP_SOURCES: {
        ipcRenderer.invoke(GET_DESKTOP_SOURCES, message).then(sendDesktopSourcesResult);
        break;
    }
    case CALLS_WIDGET_SHARE_SCREEN: {
        ipcRenderer.send(CALLS_WIDGET_SHARE_SCREEN, message.sourceID, message.withAudio);
        break;
    }
    case CALLS_JOIN_CALL: {
        ipcRenderer.invoke(CALLS_JOIN_CALL, message).then(sendCallsJoinedCall);
        break;
    }
    case CALLS_JOINED_CALL: {
        ipcRenderer.send(CALLS_JOINED_CALL, message.callID);
        break;
    }
    case CALLS_JOIN_REQUEST: {
        ipcRenderer.send(CALLS_JOIN_REQUEST, message.callID);
        break;
    }
    case CALLS_WIDGET_RESIZE: {
        ipcRenderer.send(CALLS_WIDGET_RESIZE, message.width, message.height);
        break;
    }
    case CALLS_ERROR: {
        ipcRenderer.send(CALLS_ERROR, message);
        break;
    }
    case CALLS_WIDGET_CHANNEL_LINK_CLICK:
    case CALLS_LEAVE_CALL:
    case DESKTOP_SOURCES_MODAL_REQUEST:
    case CALLS_POPOUT_FOCUS: {
        ipcRenderer.send(type);
    }
    }
});

const handleNotificationClick = ({channel, teamId, url}) => {
    window.postMessage(
        {
            type: NOTIFICATION_CLICKED,
            message: {
                channel,
                teamId,
                url,
            },
        },
        window.location.origin,
    );
};

ipcRenderer.on(NOTIFICATION_CLICKED, (event, data) => {
    handleNotificationClick(data);
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

const sendHistoryButtonReturn = (status) => {
    window.postMessage(
        {
            type: 'history-button-return',
            message: {
                enableBack: status.canGoBack,
                enableForward: status.canGoForward,
            },
        },
        window.location.origin,
    );
};

ipcRenderer.on(BROWSER_HISTORY_STATUS_UPDATED, (event, status) => sendHistoryButtonReturn(status));

const findUnread = () => {
    const classes = ['team-container unread', 'SidebarChannel unread', 'sidebar-item unread-title'];
    const isUnread = classes.some((classPair) => {
        const result = document.getElementsByClassName(classPair);
        return result && result.length > 0;
    });
    ipcRenderer.send(UNREAD_RESULT, isUnread);
};

ipcRenderer.on(IS_UNREAD, () => {
    if (isReactAppInitialized()) {
        findUnread();
    } else {
        watchReactAppUntilInitialized(() => {
            findUnread();
        });
    }
});

function getUnreadCount() {
    // LHS not found => Log out => Count should be 0, but session may be expired.
    let isExpired;
    if (document.getElementById('sidebar-left') === null) {
        const extraParam = (new URLSearchParams(window.location.search)).get('extra');
        isExpired = extraParam === 'expired';
    } else {
        isExpired = false;
    }
    if (isExpired !== sessionExpired) {
        sessionExpired = isExpired;
        ipcRenderer.send(SESSION_EXPIRED, sessionExpired);
    }
}
setInterval(getUnreadCount, UNREAD_COUNT_INTERVAL);

// push user activity updates to the webapp
ipcRenderer.on(USER_ACTIVITY_UPDATE, (event, {userIsActive, isSystemEvent}) => {
    if (window.location.origin !== 'null') {
        window.postMessage({type: USER_ACTIVITY_UPDATE, message: {userIsActive, manual: isSystemEvent}}, window.location.origin);
    }
});

window.addEventListener('storage', (e) => {
    if (e.key === '__login__' && e.storageArea === localStorage && e.newValue) {
        ipcRenderer.send(APP_LOGGED_IN);
    }
    if (e.key === '__logout__' && e.storageArea === localStorage && e.newValue) {
        ipcRenderer.send(APP_LOGGED_OUT);
    }
});

const sendDesktopSourcesResult = (sources) => {
    window.postMessage(
        {
            type: DESKTOP_SOURCES_RESULT,
            message: sources,
        },
        window.location.origin,
    );
};

const sendCallsJoinedCall = (callID) => {
    window.postMessage(
        {
            type: CALLS_JOINED_CALL,
            message: {callID},
        },
        window.location.origin,
    );
};

ipcRenderer.on(CALLS_JOIN_REQUEST, (_, callID) => {
    window.postMessage(
        {
            type: CALLS_JOIN_REQUEST,
            message: {callID},
        },
        window.location.origin,
    );
});

ipcRenderer.on(DESKTOP_SOURCES_MODAL_REQUEST, () => {
    window.postMessage(
        {
            type: DESKTOP_SOURCES_MODAL_REQUEST,
        },
        window.location.origin,
    );
});

ipcRenderer.on(CALLS_WIDGET_SHARE_SCREEN, (_, sourceID, withAudio) => {
    window.postMessage(
        {
            type: CALLS_WIDGET_SHARE_SCREEN,
            message: {sourceID, withAudio},
        },
        window.location.origin,
    );
});

ipcRenderer.on(CALLS_ERROR, (_, message) => {
    window.postMessage(
        {
            type: CALLS_ERROR,
            message,
        },
        window.location.origin,
    );
});
