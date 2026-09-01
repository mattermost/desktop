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
export type Theme = {
    sidebarBg: string;
    sidebarText: string;
    sidebarUnreadText: string;
    sidebarTextHoverBg: string;
    sidebarTextActiveBorder: string;
    sidebarTextActiveColor: string;
    sidebarHeaderBg: string;
    sidebarTeamBarBg: string;
    sidebarHeaderTextColor: string;
    onlineIndicator: string;
    awayIndicator: string;
    dndIndicator: string;
    mentionBg: string;
    mentionColor: string;
    centerChannelBg: string;
    centerChannelColor: string;
    newMessageSeparator: string;
    linkColor: string;
    buttonBg: string;
    buttonColor: string;
    errorTextColor: string;
    mentionHighlightBg: string;
    mentionHighlightLink: string;
    codeTheme: string;

    isUsingSystemTheme: boolean;
}
export type DesktopThemeProtocolCapabilities = {
    protocolVersion: 1;
}
export type SystemAppearanceUnknownReason =
    | 'unsupported'
    | 'unavailable'
    | 'invalid'
    | 'error'
    | 'unstable';
export type SystemAppearanceSnapshot =
    | {
        revision: number;
        status: 'known';
        value: 'light' | 'dark';
    }
    | {
        revision: number;
        status: 'unknown';
        reason: SystemAppearanceUnknownReason;
    };
export type SystemAppearanceInvalidation = {
    revision: number;
    previousValueStatus: 'stale' | 'invalid';
}
export type DesktopThemeMainStandbyReason =
    | 'not-current'
    | 'desktop-sync-disabled'
    | 'screen-locked'
    | 'system-suspended'
    | 'apply-failed'
    | 'theme-reset-failed';
export type DesktopThemeSurfaceState =
    | {
        revision: number;
        scope: 'main-tab';
        status: 'standby';
        reason: DesktopThemeMainStandbyReason;
    }
    | {
        revision: number;
        scope: 'main-tab';
        status: 'granted';
        leaseId: string;
    }
    | {
        revision: number;
        scope: 'popout';
        status: 'ineligible';
        reason: 'not-main-tab';
    };
export type DesktopThemeSurfaceRegistration = {
    surfaceId: string;
    state: DesktopThemeSurfaceState;
}
export type DesktopThemeSurfaceStateEvent = {
    surfaceId: string;
    state: DesktopThemeSurfaceState;
}
export type DesktopShellTheme = Omit<Theme, 'isUsingSystemTheme'>;
export type DesktopThemeDirective = {
    mode: 'fixed' | 'system';
    shellTheme: DesktopShellTheme;
}
export type DesktopThemeApplyRequest = {
    surfaceId: string;
    leaseId: string;
    sequence: number;
    directive: DesktopThemeDirective;
}
export type DesktopThemeRejectReason =
    | 'unknown-surface'
    | 'not-owner'
    | 'stale-lease'
    | 'stale-sequence'
    | 'invalid-document'
    | 'desktop-sync-disabled'
    | 'screen-locked'
    | 'system-suspended';
export type DesktopThemeFailureReason =
    | 'native-theme-update'
    | 'desktop-shell-update'
    | 'theme-reset';
export type DesktopThemeApplyResult =
    | {
        status: 'applied';
        surfaceId: string;
        leaseId: string;
        sequence: number;
    }
    | {
        status: 'rejected';
        surfaceId: string;
        leaseId: string;
        sequence: number;
        reason: DesktopThemeRejectReason;
    }
    | {
        status: 'failed';
        surfaceId: string;
        leaseId: string;
        sequence: number;
        reason: DesktopThemeFailureReason;
    };
export type DesktopThemeReleaseResult =
    | {status: 'released'}
    | {status: 'stale'};
export type DesktopThemeProtocolV1 = {
    getDesktopThemeCapabilities: () => Promise<DesktopThemeProtocolCapabilities | undefined>;
    getSystemAppearance: () => Promise<SystemAppearanceSnapshot | undefined>;
    onSystemAppearanceInvalidated: (
        listener: (event: SystemAppearanceInvalidation) => void,
    ) => () => void;
    registerDesktopThemeSurface: () => Promise<DesktopThemeSurfaceRegistration | undefined>;
    onDesktopThemeSurfaceStateChanged: (
        listener: (event: DesktopThemeSurfaceStateEvent) => void,
    ) => () => void;
    applyDesktopTheme: (
        request: DesktopThemeApplyRequest,
    ) => Promise<DesktopThemeApplyResult>;
    releaseDesktopThemeSurface: (
        surfaceId: string,
    ) => Promise<DesktopThemeReleaseResult>;
}
export type PopoutViewProps = {
    titleTemplate?: string;
    isRHS?: boolean;
};
export type SessionAttributeField = {
    name: string;
    type: string;
    attrs: {
        enabled: boolean;
        ttl_seconds: number;
        grace_period_seconds: number;
        platforms: string[];
    };
};

export type DesktopAPI = DesktopThemeProtocolV1 & {

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
    onLogin: () => void;
    onLogout: () => void;
    invalidateSessionAttributeManifest: () => void;
    resendSessionAttributes: () => void;
    updateSessionAttribute: (field: SessionAttributeField) => void;

    // Unreads/mentions/notifications
    sendNotification: (title: string, body: string, channelId: string, teamId: string, url: string, silent: boolean, soundName: string) => Promise<{status: string; reason?: string; data?: string}>;
    onNotificationClicked: (listener: (channelId: string, teamId: string, url: string) => void) => () => void;
    setUnreadsAndMentions: (isUnread: boolean, mentionCount: number) => void;

    // Navigation
    requestBrowserHistoryStatus: () => Promise<{canGoBack: boolean; canGoForward: boolean}>;
    onBrowserHistoryStatusUpdated: (listener: (canGoBack: boolean, canGoForward: boolean) => void) => () => void;
    onBrowserHistoryPush: (listener: (pathName: string) => void) => () => void;
    sendBrowserHistoryPush: (path: string) => void;

    updateTheme: (theme: Theme) => void;
    getDarkMode: () => Promise<boolean>;
    onDarkModeChanged: (listener: (darkMode: boolean) => void) => () => void;

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

    openThreadForCalls: (threadID: string) => void;
    onOpenThreadForCalls: (listener: (threadID: string) => void) => () => void;

    openStopRecordingModal: (channelID: string) => void;
    onOpenStopRecordingModal: (listener: (channelID: string) => void) => () => void;

    openCallsUserSettings: () => void;
    onOpenCallsUserSettings: (listener: () => void) => () => void;

    onSendMetrics: (listener: (metricsMap: Map<string, {cpu?: number; memory?: number}>) => void) => () => void;

    // Utility
    unregister: (channel: string) => void;
    closeWindow: () => void;

    // Popouts
    canPopout: () => Promise<boolean>;
    openPopout: (path: string, props: PopoutViewProps) => Promise<string>;
    canUsePopoutOption: (optionName: string) => Promise<boolean>;
    sendToParent: (channel: string, ...args: unknown[]) => void;
    onMessageFromParent: (listener: (channel: string, ...args: unknown[]) => void) => () => void;
    sendToPopout: (id: string, channel: string, ...args: unknown[]) => void;
    onMessageFromPopout: (listener: (id: string, channel: string, ...args: unknown[]) => void) => () => void;
    onPopoutClosed: (listener: (id: string) => void) => () => void;
    updatePopoutTitleTemplate: (titleTemplate: string) => void;
}
