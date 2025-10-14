// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcRendererEvent} from 'electron';
import {contextBridge, ipcRenderer, webFrame} from 'electron';

import type {DesktopAPI} from '@mattermost/desktop-api';

import {
    NOTIFY_MENTION,
    SESSION_EXPIRED,
    REACT_APP_INITIALIZED,
    USER_ACTIVITY_UPDATE,
    BROWSER_HISTORY_PUSH,
    GET_VIEW_INFO_FOR_TEST,
    CALLS_JOIN_CALL,
    CALLS_JOINED_CALL,
    CALLS_LEAVE_CALL,
    DESKTOP_SOURCES_MODAL_REQUEST,
    CALLS_WIDGET_SHARE_SCREEN,
    CALLS_ERROR,
    CALLS_JOIN_REQUEST,
    GET_IS_DEV_MODE,
    TOGGLE_SECURE_INPUT,
    GET_APP_INFO,
    REQUEST_BROWSER_HISTORY_STATUS,
    BROWSER_HISTORY_STATUS_UPDATED,
    NOTIFICATION_CLICKED,
    CALLS_WIDGET_RESIZE,
    CALLS_LINK_CLICK,
    CALLS_POPOUT_FOCUS,
    CALLS_WIDGET_OPEN_THREAD,
    CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL,
    CALLS_WIDGET_OPEN_USER_SETTINGS,
    GET_DESKTOP_SOURCES,
    UNREADS_AND_MENTIONS,
    TAB_LOGIN_CHANGED,
    METRICS_SEND,
    METRICS_REQUEST,
    METRICS_RECEIVE,
    UPDATE_THEME,
    DARK_MODE_CHANGE,
    GET_DARK_MODE,
    CAN_POPOUT,
    OPEN_POPOUT,
    CAN_USE_POPOUT_OPTION,
    SEND_TO_PARENT,
    SEND_TO_POPOUT,
    MESSAGE_FROM_PARENT,
    MESSAGE_FROM_POPOUT,
    POPOUT_CLOSED,
} from 'common/communication';

import type {ExternalAPI} from 'types/externalAPI';

const createListener: ExternalAPI['createListener'] = (channel: string, listener: (...args: never[]) => void) => {
    const listenerWithEvent = (_: IpcRendererEvent, ...args: unknown[]) =>
        listener(...args as never[]);
    ipcRenderer.on(channel, listenerWithEvent);
    return () => {
        ipcRenderer.off(channel, listenerWithEvent);
    };
};

const desktopAPI: DesktopAPI = {

    // Initialization
    isDev: () => ipcRenderer.invoke(GET_IS_DEV_MODE),
    getAppInfo: () => ipcRenderer.invoke(GET_APP_INFO),
    reactAppInitialized: () => {
        getThemeValues();
        ipcRenderer.send(REACT_APP_INITIALIZED);
    },

    // Session
    setSessionExpired: (isExpired) => ipcRenderer.send(SESSION_EXPIRED, isExpired),
    onUserActivityUpdate: (listener) => createListener(USER_ACTIVITY_UPDATE, listener),

    onLogin: () => ipcRenderer.send(TAB_LOGIN_CHANGED, true),
    onLogout: () => ipcRenderer.send(TAB_LOGIN_CHANGED, false),

    // Unreads/mentions/notifications
    sendNotification: (title, body, channelId, teamId, url, silent, soundName) =>
        ipcRenderer.invoke(NOTIFY_MENTION, title, body, channelId, teamId, url, silent, soundName),
    onNotificationClicked: (listener) => createListener(NOTIFICATION_CLICKED, listener),
    setUnreadsAndMentions: (isUnread, mentionCount) => ipcRenderer.send(UNREADS_AND_MENTIONS, isUnread, mentionCount),

    // Navigation
    requestBrowserHistoryStatus: () => ipcRenderer.invoke(REQUEST_BROWSER_HISTORY_STATUS),
    onBrowserHistoryStatusUpdated: (listener) => createListener(BROWSER_HISTORY_STATUS_UPDATED, listener),
    onBrowserHistoryPush: (listener) => createListener(BROWSER_HISTORY_PUSH, listener),
    sendBrowserHistoryPush: (path) => ipcRenderer.send(BROWSER_HISTORY_PUSH, path),

    updateTheme: (theme) => ipcRenderer.send(UPDATE_THEME, theme),
    getDarkMode: () => ipcRenderer.invoke(GET_DARK_MODE),
    onDarkModeChanged: (listener) => createListener(DARK_MODE_CHANGE, listener),

    // Calls
    joinCall: (opts) => ipcRenderer.invoke(CALLS_JOIN_CALL, opts),
    leaveCall: () => ipcRenderer.send(CALLS_LEAVE_CALL),

    callsWidgetConnected: (callID, sessionID) => ipcRenderer.send(CALLS_JOINED_CALL, callID, sessionID),
    resizeCallsWidget: (width, height) => ipcRenderer.send(CALLS_WIDGET_RESIZE, width, height),

    sendCallsError: (err, callID, errMsg) => ipcRenderer.send(CALLS_ERROR, err, callID, errMsg),
    onCallsError: (listener) => createListener(CALLS_ERROR, listener),

    getDesktopSources: (opts) => ipcRenderer.invoke(GET_DESKTOP_SOURCES, opts),
    openScreenShareModal: () => ipcRenderer.send(DESKTOP_SOURCES_MODAL_REQUEST),
    onOpenScreenShareModal: (listener) => createListener(DESKTOP_SOURCES_MODAL_REQUEST, listener),

    shareScreen: (sourceID, withAudio) => ipcRenderer.send(CALLS_WIDGET_SHARE_SCREEN, sourceID, withAudio),
    onScreenShared: (listener) => createListener(CALLS_WIDGET_SHARE_SCREEN, listener),

    sendJoinCallRequest: (callId) => ipcRenderer.send(CALLS_JOIN_REQUEST, callId),
    onJoinCallRequest: (listener) => createListener(CALLS_JOIN_REQUEST, listener),

    openLinkFromCalls: (url) => ipcRenderer.send(CALLS_LINK_CLICK, url),

    focusPopout: () => ipcRenderer.send(CALLS_POPOUT_FOCUS),

    openThreadForCalls: (threadID) => ipcRenderer.send(CALLS_WIDGET_OPEN_THREAD, threadID),
    onOpenThreadForCalls: (listener) => createListener(CALLS_WIDGET_OPEN_THREAD, listener),

    openStopRecordingModal: (channelID) => ipcRenderer.send(CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL, channelID),
    onOpenStopRecordingModal: (listener) => createListener(CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL, listener),

    openCallsUserSettings: () => ipcRenderer.send(CALLS_WIDGET_OPEN_USER_SETTINGS),
    onOpenCallsUserSettings: (listener) => createListener(CALLS_WIDGET_OPEN_USER_SETTINGS, listener),

    onSendMetrics: (listener) => createListener(METRICS_SEND, listener),

    // Utility
    unregister: (channel) => ipcRenderer.removeAllListeners(channel),

    // Popouts
    canPopout: () => ipcRenderer.invoke(CAN_POPOUT),
    openPopout: (path, props) => ipcRenderer.invoke(OPEN_POPOUT, path, props),
    canUsePopoutOption: (optionName) => ipcRenderer.invoke(CAN_USE_POPOUT_OPTION, optionName),
    sendToParent: (channel, ...args) => ipcRenderer.send(SEND_TO_PARENT, channel, ...args),
    onMessageFromParent: (listener) => createListener(MESSAGE_FROM_PARENT, listener),
    sendToPopout: (id, channel, ...args) => ipcRenderer.send(SEND_TO_POPOUT, id, channel, ...args),
    onMessageFromPopout: (listener) => createListener(MESSAGE_FROM_POPOUT, listener),
    onPopoutClosed: (listener) => createListener(POPOUT_CLOSED, listener),
};
contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);

ipcRenderer.on(METRICS_REQUEST, async (_, name, serverId) => {
    const memory = await process.getProcessMemoryInfo();
    ipcRenderer.send(METRICS_RECEIVE, name, {serverId, cpu: process.getCPUUsage().percentCPUUsage, memory: memory.residentSet ?? memory.private});
});

// Call this once to unset it to 0
process.getCPUUsage();

// Specific info for the testing environment
if (process.env.NODE_ENV === 'test') {
    contextBridge.exposeInMainWorld('testHelper', {
        getViewInfoForTest: () => ipcRenderer.invoke(GET_VIEW_INFO_FOR_TEST),
    });
}

/****************************************************************************
 * window/document listeners
 * These are here to perform specific tasks when global window or document events happen
 * Avoid using these unless absolutely necessary
 ****************************************************************************
 */

// Enable secure input on macOS clients when the user is on a password input
let isPasswordBox = false;
const shouldSecureInput = (element: {tagName?: string; type?: string} | null, force = false) => {
    const targetIsPasswordBox = (element && element.tagName === 'INPUT' && element.type === 'password');
    if (targetIsPasswordBox && (!isPasswordBox || force)) {
        ipcRenderer.send(TOGGLE_SECURE_INPUT, true);
    } else if (!targetIsPasswordBox && (isPasswordBox || force)) {
        ipcRenderer.send(TOGGLE_SECURE_INPUT, false);
    }

    isPasswordBox = Boolean(targetIsPasswordBox);
};
window.addEventListener('focusin', (event) => {
    shouldSecureInput(event.target as Element);
});
window.addEventListener('focus', () => {
    shouldSecureInput(document.activeElement, true);
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
const CLEAR_CACHE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
setInterval(() => {
    webFrame.clearCache();
}, CLEAR_CACHE_INTERVAL);

function getThemeValues() {
    const style = window.getComputedStyle(document.body);
    ipcRenderer.send(UPDATE_THEME, {
        sidebarBg: style.getPropertyValue('--sidebar-bg'),
        sidebarText: style.getPropertyValue('--sidebar-text'),
        sidebarUnreadText: style.getPropertyValue('--sidebar-unread-text'),
        sidebarTextHoverBg: style.getPropertyValue('--sidebar-text-hover-bg'),
        sidebarTextActiveBorder: style.getPropertyValue('--sidebar-text-active-border'),
        sidebarTextActiveColor: style.getPropertyValue('--sidebar-text-active-color'),
        sidebarHeaderBg: style.getPropertyValue('--sidebar-header-bg'),
        sidebarTeamBarBg: style.getPropertyValue('--sidebar-team-bar-bg'),
        sidebarHeaderTextColor: style.getPropertyValue('--sidebar-header-text-color'),
        onlineIndicator: style.getPropertyValue('--online-indicator'),
        awayIndicator: style.getPropertyValue('--away-indicator'),
        dndIndicator: style.getPropertyValue('--dnd-indicator'),
        mentionBg: style.getPropertyValue('--mention-bg'),
        mentionColor: style.getPropertyValue('--mention-color'),
        centerChannelBg: style.getPropertyValue('--center-channel-bg'),
        centerChannelColor: style.getPropertyValue('--center-channel-color'),
        newMessageSeparator: style.getPropertyValue('--new-message-separator'),
        linkColor: style.getPropertyValue('--link-color'),
        buttonBg: style.getPropertyValue('--button-bg'),
        buttonColor: style.getPropertyValue('--button-color'),
        errorTextColor: style.getPropertyValue('--error-text-color'),
        mentionHighlightBg: style.getPropertyValue('--mention-highlight-bg'),
        mentionHighlightLink: style.getPropertyValue('--mention-highlight-link'),
        codeTheme: style.getPropertyValue('--code-theme'),
    });
}
