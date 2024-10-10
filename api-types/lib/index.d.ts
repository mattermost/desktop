export type DesktopSourcesOptions = {
    types: Array<'screen' | 'window'>;
    thumbnailSize?: {
        height: number;
        width: number;
    };
    fetchWindowIcons?: boolean;
};
export type DesktopCaptureSource = {
    id: string;
    name: string;
    thumbnailURL: string;
};
export type DesktopAPI = {
    isDev: () => Promise<boolean>;
    getAppInfo: () => Promise<{
        name: string;
        version: string;
    }>;
    reactAppInitialized: () => void;
    setSessionExpired: (isExpired: boolean) => void;
    onUserActivityUpdate: (listener: (userIsActive: boolean, idleTime: number, isSystemEvent: boolean) => void) => () => void;
    onLogin: () => void;
    onLogout: () => void;
    sendNotification: (title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, soundName: string) => Promise<{
        status: string;
        reason?: string;
        data?: string;
    }>;
    onNotificationClicked: (listener: (channelId: string, teamId: string, url: string) => void) => () => void;
    setUnreadsAndMentions: (isUnread: boolean, mentionCount: number) => void;
    requestBrowserHistoryStatus: () => Promise<{
        canGoBack: boolean;
        canGoForward: boolean;
    }>;
    onBrowserHistoryStatusUpdated: (listener: (canGoBack: boolean, canGoForward: boolean) => void) => () => void;
    onBrowserHistoryPush: (listener: (pathName: string) => void) => () => void;
    sendBrowserHistoryPush: (path: string) => void;
    joinCall: (opts: {
        callID: string;
        title: string;
        rootID: string;
        channelURL: string;
    }) => Promise<{
        callID: string;
        sessionID: string;
    }>;
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
    openThreadForCalls: (threadID: string) => void;
    onOpenThreadForCalls: (listener: (threadID: string) => void) => () => void;
    openStopRecordingModal: (channelID: string) => void;
    onOpenStopRecordingModal: (listener: (channelID: string) => void) => () => void;
    openCallsUserSettings: () => void;
    onOpenCallsUserSettings: (listener: () => void) => () => void;
    onSendMetrics: (listener: (metricsMap: Map<string, {
        cpu?: number;
        memory?: number;
    }>) => void) => () => void;
    unregister: (channel: string) => void;
};
