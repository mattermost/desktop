// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type DesktopAPI = {

    // Initialization
    isDev: () => Promise<boolean>;
    getAppInfo: () => Promise<{name: string; version: string}>;
    reactAppInitialized: () => void;

    // Session
    loggedIn: () => void;
    loggedOut: () => void;
    setSessionExpired: (isExpired: boolean) => void;
    onUserActivityUpdate: (listener: (
        userIsActive: boolean,
        idleTime: number,
        isSystemEvent: boolean,
    ) => void) => void;

    // Unreads/mentions/notifications
    sendNotification: (title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, soundName: string) => void;
    onNotificationClicked: (listener: (channelId: string, teamId: string, url: string) => void) => void;
    updateUnread: (isUnread: boolean) => void;
    updateMentions: (mentionCount: number) => void;

    // Navigation
    requestBrowserHistoryStatus: () => Promise<{canGoBack: boolean; canGoForward: boolean}>;
    onBrowserHistoryStatusUpdated: (listener: (canGoBack: boolean, canGoForward: boolean) => void) => void;
    onBrowserHistoryPush: (listener: (pathName: string) => void) => void;
    sendBrowserHistoryPush: (path: string) => void;

    // Calls widget
    openLinkFromCallsWidget: (url: string) => void;
    openScreenShareModal: () => void;
    onScreenShared: (listener: (sourceID: string, withAudio: boolean) => void) => void;
    callsWidgetConnected: (callID: string) => void;
    onJoinCallRequest: (listener: (callID: string) => void) => void;
    resizeCallsWidget: (width: number, height: number) => void;
    focusPopout: () => void;
    leaveCall: () => void;
    sendCallsError: (err: string, callID?: string, errMsg?: string) => void;

    // Calls plugin
    getDesktopSources: (opts: Array<{
        types: Array<'screen' | 'window'>;
        thumbnailSize?: {height: number; width: number};
        fetchWindowIcons?: boolean;
    }>) => Promise<Array<{
        id: string;
        name: string;
        thumbnailURL: string;
    }>>;
    onOpenScreenShareModal: (listener: () => void) => void;
    shareScreen: (sourceID: string, withAudi: boolean) => void;
    joinCall: (opts: {
        callID: string;
        title: string;
        rootID: string;
        channelURL: string;
    }) => Promise<string>;
    sendJoinCallRequest: (callId: string) => void;
    onCallsError: (listener: (err: string, callID?: string, errMsg?: string) => void) => void;

    // Utility
    unregister: (channel: string) => void;
}
