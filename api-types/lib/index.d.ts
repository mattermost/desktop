export declare type DesktopSourcesOptions = {
    types: Array<'screen' | 'window'>;
    thumbnailSize?: {
        height: number;
        width: number;
    };
    fetchWindowIcons?: boolean;
};
export declare type DesktopCaptureSource = {
    id: string;
    name: string;
    thumbnailURL: string;
};
export declare type DesktopAPI = {
    isDev: () => Promise<boolean>;
    getAppInfo: () => Promise<{
        name: string;
        version: string;
    }>;
    reactAppInitialized: () => void;
    setSessionExpired: (isExpired: boolean) => void;
    onUserActivityUpdate: (listener: (userIsActive: boolean, idleTime: number, isSystemEvent: boolean) => void) => () => void;
    sendNotification: (title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, soundName: string) => void;
    onNotificationClicked: (listener: (channelId: string, teamId: string, url: string) => void) => () => void;
    setUnreadsAndMentions: (isUnread: boolean, mentionCount: number) => void;
    requestBrowserHistoryStatus: () => Promise<{
        canGoBack: boolean;
        canGoForward: boolean;
    }>;
    onBrowserHistoryStatusUpdated: (listener: (canGoBack: boolean, canGoForward: boolean) => void) => () => void;
    onBrowserHistoryPush: (listener: (pathName: string) => void) => () => void;
    sendBrowserHistoryPush: (path: string) => void;
    openLinkFromCallsWidget: (url: string) => void;
    openScreenShareModal: () => void;
    onScreenShared: (listener: (sourceID: string, withAudio: boolean) => void) => () => void;
    callsWidgetConnected: (callID: string, sessionID: string) => void;
    onJoinCallRequest: (listener: (callID: string) => void) => () => void;
    resizeCallsWidget: (width: number, height: number) => void;
    focusPopout: () => void;
    leaveCall: () => void;
    sendCallsError: (err: string, callID?: string, errMsg?: string) => void;
    getDesktopSources: (opts: DesktopSourcesOptions) => Promise<DesktopCaptureSource[]>;
    onOpenScreenShareModal: (listener: () => void) => () => void;
    shareScreen: (sourceID: string, withAudi: boolean) => void;
    joinCall: (opts: {
        callID: string;
        title: string;
        rootID: string;
        channelURL: string;
    }) => Promise<{
        callID: string;
        sessionID: string;
    }>;
    sendJoinCallRequest: (callId: string) => void;
    onCallsError: (listener: (err: string, callID?: string, errMsg?: string) => void) => () => void;
    unregister: (channel: string) => void;
};
