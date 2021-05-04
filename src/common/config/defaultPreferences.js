// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Default user preferences. End-users can change these parameters by editing config.json
 * @param {number} version - Scheme version. (Not application version)
 */

const getDefaultDownloadLocation = () => {
    switch (process.platform) {
    case 'darwin':
        return `/Users/${process.env.USER || process.env.USERNAME}/Downloads`;
    case 'win32':
        return `C:\\Users\\${process.env.USER || process.env.USERNAME}\\Downloads`;
    case 'linux':
        return `/home/${process.env.USER || process.env.USERNAME}/Downloads`;
    default:
        return '';
    };
};

const defaultPreferences = {
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
};

export default defaultPreferences;
