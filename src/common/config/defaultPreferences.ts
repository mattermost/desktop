// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'os';
import path from 'path';

import {app} from 'electron';

/**
 * Default user preferences. End-users can change these parameters by editing config.json
 * @param {number} version - Scheme version. (Not application version)
 */

import type {ConfigV3} from 'types/config';

export const getDefaultDownloadLocation = (): string | undefined => {
    // eslint-disable-next-line no-undef
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (__IS_MAC_APP_STORE__) {
        return undefined;
    }

    if (process.platform === 'linux' && process.env.XDG_DOWNLOAD_DIR) {
        return process.env.XDG_DOWNLOAD_DIR;
    }

    return app.getPath('downloads') || path.join(os.homedir(), 'Downloads');
};

const defaultPreferences: ConfigV3 = {
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
};

export default defaultPreferences;
