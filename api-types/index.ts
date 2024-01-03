// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type DesktopSourcesOptions = {
    types: Array<'screen' | 'window'>;
    thumbnailSize?: {height: number; width: number};
    fetchWindowIcons?: boolean;
};
export type DesktopCaptureSource = {
    id: string;
    name: string;
    thumbnailURL: string;
};

export type DesktopAPI = {

    // Initialization
    isDev: () => Promise<boolean>;
    getAppInfo: () => Promise<{name: string; version: string}>;
    reactAppInitialized: () => void;

    // Session
    setSessionExpired: (isExpired: boolean) => void;
    onUserActivityUpdate: (listener: (
        userIsActive: boolean,
        idleTime: number,
        isSystemEvent: boolean,
    ) => void) => () => void;

    // Unreads/mentions/notifications
    sendNotification: (title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, soundName: string) => void;
    onNotificationClicked: (listener: (channelId: string, teamId: string, url: string) => void) => () => void;
    setUnreadsAndMentions: (isUnread: boolean, mentionCount: number) => void;

    // Navigation
    requestBrowserHistoryStatus: () => Promise<{canGoBack: boolean; canGoForward: boolean}>;
    onBrowserHistoryStatusUpdated: (listener: (canGoBack: boolean, canGoForward: boolean) => void) => () => void;
    onBrowserHistoryPush: (listener: (pathName: string) => void) => () => void;
    sendBrowserHistoryPush: (path: string) => void;

    // Calls
    joinCall: (opts: {
        callID: string;
        title: string;
        rootID: string;
        channelURL: string;
    }) => Promise<{callID: string; sessionID: string}>;
    leaveCall: () => void;

    callsWidgetConnected: (callID: string, sessionID: string) => void;
    resizeCallsWidget: (width: number, height: number) => void;

    sendCallsError: (err: string, callID?: string, errMsg?: string) => void;
    onCallsError: (listener: (err: string, callID?: string, errMsg?: string) => void) => () => void;

    getDesktopSources: (opts: DesktopSourcesOptions) => Promise<DesktopCaptureSource[]>;

    openScreenShareModal: () => void;
    onOpenScreenShareModal: (listener: () => void) => () => void;

    shareScreen: (sourceID: string, withAudio: boolean) => void;
    onScreenShared: (listener: (sourceID: string, withAudio: boolean) => void) => () => void;

    sendJoinCallRequest: (callId: string) => void;
    onJoinCallRequest: (listener: (callID: string) => void) => () => void;

    openLinkFromCalls: (url: string) => void;

    focusPopout: () => void;

    // Utility
    unregister: (channel: string) => void;
}
