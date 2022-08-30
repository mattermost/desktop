// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DownloadItemTypeEnum} from 'main/downloadsManager';

export type Tab = {
    name: string;
    order: number;
    isOpen?: boolean;
}

export type Team = {
    name: string;
    order: number;
    url: string;
    lastActiveTab?: number;
}

export type TeamWithIndex = Team & {index: number};
export type TeamWithTabs = Team & {tabs: Tab[]};

export type Config = ConfigV4;

export type ConfigV4 = {
    version: 4;
    teams: TeamWithTabs[];
    showTrayIcon: boolean;
    trayIconTheme: string;
    minimizeToTray: boolean;
    notifications: {
        flashWindow: number;
        bounceIcon: boolean;
        bounceIconType: 'critical' | 'informational';
    };
    showUnreadBadge: boolean;
    useSpellChecker: boolean;
    enableHardwareAcceleration: boolean;
    autostart: boolean;
    hideOnStart: boolean;
    spellCheckerLocales: string[];
    darkMode: boolean;
    downloadLocation?: string;
    spellCheckerURL?: string;
    lastActiveTeam?: number;
    startInFullscreen?: boolean;
    autoCheckForUpdates?: boolean;
    alwaysMinimize?: boolean;
    alwaysClose?: boolean;
    logLevel?: string;
    appLanguage?: string;
    downloads: DownloadItems;
}

export type ConfigV3 = {
    version: 3;
    teams: TeamWithTabs[];
    showTrayIcon: boolean;
    trayIconTheme: string;
    minimizeToTray: boolean;
    notifications: {
        flashWindow: number;
        bounceIcon: boolean;
        bounceIconType: 'critical' | 'informational';
    };
    showUnreadBadge: boolean;
    useSpellChecker: boolean;
    enableHardwareAcceleration: boolean;
    autostart: boolean;
    hideOnStart: boolean;
    spellCheckerLocales: string[];
    darkMode: boolean;
    downloadLocation?: string;
    spellCheckerURL?: string;
    lastActiveTeam?: number;
    startInFullscreen?: boolean;
    autoCheckForUpdates?: boolean;
    alwaysMinimize?: boolean;
    alwaysClose?: boolean;
    logLevel?: string;
    appLanguage?: string;
}

export type ConfigV2 = {
    version: 2;
    teams: Array<{
        name: string;
        url: string;
        order: number;
    }>;
    showTrayIcon: boolean;
    trayIconTheme: string;
    minimizeToTray: boolean;
    notifications: {
        flashWindow: number;
        bounceIcon: boolean;
        bounceIconType: 'critical' | 'informational';
    };
    showUnreadBadge: boolean;
    useSpellChecker: boolean;
    enableHardwareAcceleration: boolean;
    autostart: boolean;
    spellCheckerLocale: string;
    spellCheckerURL?: string;
    darkMode: boolean;
    downloadLocation?: string;
}

export type ConfigV1 = {
    version: 1;
    teams: Array<{
        name: string;
        url: string;
    }>;
    showTrayIcon: boolean;
    trayIconTheme: string;
    minimizeToTray: boolean;
    notifications: {
        flashWindow: number;
        bounceIcon: boolean;
        bounceIconType: 'critical' | 'informational';
    };
    showUnreadBadge: boolean;
    useSpellChecker: boolean;
    spellCheckerURL?: string;
    enableHardwareAcceleration: boolean;
    autostart: boolean;
    spellCheckerLocale: string;
}

export type ConfigV0 = {version: 0; url: string};

export type AnyConfig = ConfigV4 | ConfigV3 | ConfigV2 | ConfigV1 | ConfigV0;

export type BuildConfig = {
    defaultTeams?: Team[];
    helpLink: string;
    enableServerManagement: boolean;
    enableAutoUpdater: boolean;
    managedResources: string[];
    allowedProtocols: string[];
}

export type RegistryConfig = {
    teams: Team[];
    enableServerManagement: boolean;
    enableAutoUpdater: boolean;
}

export type CombinedConfig = ConfigV4 & BuildConfig & {
    registryTeams: Team[];
    appName: string;
    useNativeWindow: boolean;

}

export type LocalConfiguration = Config & {
    appName: string;
    enableServerManagement: boolean;
    canUpgrade: boolean;
}

export type MigrationInfo = {
    updateTrayIconWin32: boolean;
    masConfigs: boolean;
}

export type DownloadItemUpdatedEventState = 'interrupted' | 'progressing';
export type DownloadItemDoneEventState = 'completed' | 'cancelled' | 'interrupted';
export type DownloadItemState = DownloadItemUpdatedEventState | DownloadItemDoneEventState | 'deleted';

export type ConfigDownloadItem = {
    type: DownloadItemTypeEnum;
    filename: string;
    state: DownloadItemState;
    progress: number;
    location: string;
    mimeType: string | null;
    addedAt: number;
    receivedBytes: number;
    totalBytes: number;
}

export type DownloadItems = Record<string, ConfigDownloadItem>;
