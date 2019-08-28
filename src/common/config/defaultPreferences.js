// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Default user preferences. End-users can change these parameters by editing config.json
 * @param {number} version - Scheme version. (Not application version)
 */
const defaultPreferences = {
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
};

export default defaultPreferences;
