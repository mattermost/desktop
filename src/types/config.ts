// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type View = {
    name: string;
    isOpen?: boolean;
}

export type Server = {
    name: string;
    url: string;
}

export type ConfigView = View & {
    order: number;
}

export type ConfigServer = Server & {
    order: number;
    lastActiveTab?: number;
    tabs: ConfigView[];
}

export type UniqueServer = Server & {
    id?: string;
    isPredefined?: boolean;
}

export type UniqueView = View & {
    id?: string;
}

export type Config = ConfigV3;

export type ConfigV3 = {
    version: 3;
    teams: ConfigServer[];
    showTrayIcon: boolean;
    trayIconTheme: string;
    minimizeToTray: boolean;
    notifications: {
        flashWindow: number;
        bounceIcon: boolean;
        bounceIconType: '' | 'critical' | 'informational';
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
    enableMetrics?: boolean;
}

export type ConfigV2 =
    Omit<ConfigV3,
    'version' |
    'teams' |
    'hideOnStart' |
    'spellCheckerLocales' |
    'lastActiveTeam' |
    'startInFullscreen' |
    'autoCheckForUpdates' |
    'alwaysMinimize' |
    'alwaysClose' |
    'logLevel' |
    'appLanguage'
    > & {
        version: 2;
        teams: Array<{
            name: string;
            url: string;
            order: number;
        }>;
        spellCheckerLocale: string;
    }

export type ConfigV1 =
    Omit<ConfigV2,
    'version' |
    'teams' |
    'darkMode' |
    'downloadLocation'
    > & {
        version: 1;
        teams: Array<{
            name: string;
            url: string;
        }>;
    }

export type ConfigV0 = {version: 0; url: string};

export type AnyConfig = ConfigV3 | ConfigV2 | ConfigV1 | ConfigV0;

export type BuildConfig = {
    defaultServers?: Server[];
    helpLink: string;
    academyLink: string;
    upgradeLink: string;
    enableServerManagement: boolean;
    enableAutoUpdater: boolean;
    managedResources: string[];
    allowedProtocols: string[];
}

export type RegistryConfig = {
    servers: Server[];
    enableServerManagement: boolean;
    enableAutoUpdater: boolean;
}

export type CombinedConfig = Omit<Config, 'teams'> & Omit<BuildConfig, 'defaultServers'> & {
    appName: string;
}

export type LocalConfiguration = Config & {
    appName: string;
    enableServerManagement: boolean;
    canUpgrade: boolean;
}

export type MigrationInfo = {
    updateTrayIconWin32: boolean;
    masConfigs: boolean;
    closeExtraTabs: boolean;
    enableMetrics: boolean;
}
