// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import type {ConfigV0, ConfigV1, ConfigV2, ConfigV3} from 'types/config';

import defaultPreferences, {getDefaultDownloadLocation} from './defaultPreferences';

const pastDefaultPreferences = {
    0: {
        url: '',
    } as ConfigV0,
    1: {
        version: 1,
        teams: [],
        showTrayIcon: false,
        trayIconTheme: 'light',
        minimizeToTray: false,
        notifications: {
            flashWindow: 0,
            bounceIcon: false,
            bounceIconType: 'informational',
        },
        showUnreadBadge: true,
        useSpellChecker: true,
        enableHardwareAcceleration: true,
        autostart: true,
        spellCheckerLocale: 'en-US',
    } as ConfigV1,
    2: {
        version: 2,
        teams: [],
        showTrayIcon: true,
        trayIconTheme: 'light',
        minimizeToTray: true,
        notifications: {
            flashWindow: 2,
            bounceIcon: true,
            bounceIconType: 'informational',
        },
        showUnreadBadge: true,
        useSpellChecker: true,
        enableHardwareAcceleration: true,
        autostart: true,
        spellCheckerLocale: 'en-US',
        darkMode: false,
        downloadLocation: getDefaultDownloadLocation(),
    } as ConfigV2,
    3: {
        version: 3,
        teams: [],
        showTrayIcon: true,
        trayIconTheme: 'use_system',
        minimizeToTray: process.platform !== 'linux',
        notifications: {
            flashWindow: process.platform === 'linux' ? 0 : 2,
            bounceIcon: true,
            bounceIconType: 'informational',
        },
        showUnreadBadge: true,
        useSpellChecker: true,
        enableHardwareAcceleration: true,
        autostart: true,
        hideOnStart: false,
        spellCheckerLocales: [],
        darkMode: false,
        lastActiveTeam: 0,
        downloadLocation: getDefaultDownloadLocation(),
        startInFullscreen: false,
        logLevel: 'info',
        enableMetrics: true,
        autoCheckForUpdates: true,
        alwaysMinimize: false,
        alwaysClose: false,
        appLanguage: '',
    } as ConfigV3,
    4: defaultPreferences,
};

export default pastDefaultPreferences;
