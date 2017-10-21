/**
 * Build-time configuration. End-users can't change these parameters.
 * @prop {Object[]} defaultTeams
 * @prop {string} defaultTeams[].name - The tab name for default team.
 * @prop {string} defaultTeams[].url - The URL for default team.
 * @prop {string} helpLink - The URL for "Help->Learn More..." menu item.
 *                           If null is specified, the menu disappears.
 */
const buildConfig = {
  defaultTeams: [/*
    {
      name: 'example',
      url: 'https://example.com'
    }*/
  ],
  helpLink: 'https://docs.mattermost.com/help/apps/desktop-guide.html'
};

module.exports = buildConfig;
