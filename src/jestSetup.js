// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('main/constants', () => ({
    configPath: 'configPath',
    allowedProtocolFile: 'allowedProtocolFile',
    appVersionJson: 'appVersionJson',
    certificateStorePath: 'certificateStorePath',
    trustedOriginsStoreFile: 'trustedOriginsStoreFile',
    boundsInfoPath: 'boundsInfoPath',

    updatePaths: jest.fn(),
}));

jest.mock('electron-log', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    transports: {
        file: {
            level: '',
        },
    },
}));

