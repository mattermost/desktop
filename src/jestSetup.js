// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('main/constants', () => ({
    configPath: 'configPath',
    allowedProtocolFile: 'allowedProtocolFile',
    appVersionJson: 'appVersionJson',
    certificateStorePath: 'certificateStorePath',
    trustedOriginsStoreFile: 'trustedOriginsStoreFile',
    boundsInfoPath: 'boundsInfoPath',
}));
