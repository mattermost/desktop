// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import defaultPreferences from './defaultPreferences';

const pastDefaultPreferences = {
  0: {
    url: '',
  },
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
  },
};

pastDefaultPreferences[`${defaultPreferences.version}`] = defaultPreferences;

export default pastDefaultPreferences;
