// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-undef */

jest.mock('main/constants', () => ({
    configPath: 'configPath',
    allowedProtocolFile: 'allowedProtocolFile',
    appVersionJson: 'appVersionJson',
    certificateStorePath: 'certificateStorePath',
    trustedOriginsStoreFile: 'trustedOriginsStoreFile',
    boundsInfoPath: 'boundsInfoPath',

    updatePaths: jest.fn(),
}));

jest.mock('common/log', () => {
    const logLevelsFn = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        silly: jest.fn(),
    };
    return {
        Logger: jest.fn().mockImplementation(() => ({
            ...logLevelsFn,
            withPrefix: () => ({
                ...logLevelsFn,
            }),
        })),
        setLoggingLevel: jest.fn(),
        getLevel: jest.fn(),
    };
});

