// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BuildConfig} from 'types/config';

// For detailed guides, please refer to https://docs.mattermost.com/deployment/desktop-app-deployment.html

/**
 * Build-time configuration. End-users can't change these parameters.
 * @prop {Object[]} defaultTeams
 * @prop {string} defaultTeams[].name - The tab name for default team.
 * @prop {string} defaultTeams[].url - The URL for default team.
 * @prop {string} defaultTeams[].order - Sort order for team tabs (0, 1, 2)
 * @prop {string} helpLink - The URL for "Help->Learn More..." menu item.
 *                           If null is specified, the menu disappears.
 * @prop {boolean} enableServerManagement - Whether users can edit servers configuration.
 *                                          Specify at least one server for "defaultTeams"
 *                                          when "enableServerManagement is set to false
 * @prop {[]} managedResources - Defines which paths are managed
 * @prop {[]} allowedProtocols - Defines which protocols should be automatically allowed
 */
const buildConfig: BuildConfig = {
    defaultTeams: [/*
    {
      name: 'example',
      url: 'https://example.com'
    }
  */],
    helpLink: 'https://docs.mattermost.com/messaging/managing-desktop-app-servers.html',
    enableServerManagement: true,
    enableAutoUpdater: true,
    managedResources: ['trusted'],
    allowedProtocols: [
        'mattermost',
        'ftp',
        'mailto',
        'tel',
    ],
};

export default buildConfig;
