// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import os from 'os';

/**
 * Default user preferences. End-users can change these parameters by editing config.json
 * @param {number} version - Scheme version. (Not application version)
 */

import {ConfigV3} from 'types/config';

export const getDefaultDownloadLocation = (): string => {
    return path.join(os.homedir(), 'Downloads');
};

const defaultPreferences: ConfigV3 = {
    version: 3,
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
