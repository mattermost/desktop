// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// For detailed guides, please refer to https://docs.mattermost.com/deployment/desktop-app-deployment.html

/**
 * Build-time configuration. End-users can't change these parameters.
 * @prop {Object[]} defaultServers
 * @prop {string} defaultServers[].name - The tab name for default server.
 * @prop {string} defaultServers[].url - The URL for default server.
 * @prop {string} helpLink - The URL for "Help->Learn More..." menu item.
 *                           If null is specified, the menu disappears.
 * @prop {boolean} enableServerManagement - Whether users can edit servers configuration.
 *                                          Specify at least one server for "defaultServers"
 *                                          when "enableServerManagement is set to false
 */
const buildConfig = {
  defaultServers: [/*
    {
      name: 'example',
      url: 'https://example.com'
    }*/
  ],
  helpLink: 'https://about.mattermost.com/default-desktop-app-documentation/',
  enableServerManagement: true,
  enableAutoUpdater: true,
};

export default buildConfig;
