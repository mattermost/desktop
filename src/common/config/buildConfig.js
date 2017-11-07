/**
 * Build-time configuration. End-users can't change these parameters.
 * @prop {Object[]} defaultTeams
 * @prop {string} defaultTeams[].name - The tab name for default team.
 * @prop {string} defaultTeams[].url - The URL for default team.
 * @prop {string} helpLink - The URL for "Help->Learn More..." menu item.
 *                           If null is specified, the menu disappears.
 * @prop {boolean} enableServerManagement - Whether users can edit servers configuration.
 *                                          If false is specified, defaultTeams must have a team at least.
 */
const buildConfig = {
  defaultTeams: [/*
    {
      name: 'example',
      url: 'https://example.com'
    }*/
  ],
  helpLink: 'https://docs.mattermost.com/help/apps/desktop-guide.html',
  enableServerManagement: true
};

module.exports = buildConfig;
