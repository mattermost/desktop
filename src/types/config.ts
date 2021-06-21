// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Team = {
    name: string;
    url: string;
    order: number;
}

export type Config = ConfigV2;

export type ConfigV2 = {
    version: 2;
    teams: Team[];
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
    darkMode: boolean;
    downloadLocation: string;
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
    enableHardwareAcceleration: boolean;
    autostart: boolean;
    spellCheckerLocale: string;
}

export type ConfigV0 = {version: 0; url: string};

export type AnyConfig = ConfigV2 | ConfigV1 | ConfigV0;

export type BuildConfig = {
    defaultTeams?: Team[];
    helpLink: string;
    enableServerManagement: boolean;
    enableAutoUpdater: boolean;
    managedResources: string[];
}

export type RegistryConfig = {
    teams: Team[];
    enableServerManagement: boolean;
    enableAutoUpdater: boolean;
}

export type CombinedConfig = ConfigV2 & BuildConfig & {
    registryTeams: Team[];
    appName: string;
}
