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
};

module.exports = defaultPreferences;
