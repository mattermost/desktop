// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Diagnostics from '.';

// Mock electron so this suite (and the diagnostic steps it imports) doesn't load the real
// `electron` module, which needs the downloaded binary and otherwise fails with
// "Electron failed to install correctly" in CI. Only the surface used by index.ts and the
// imported steps is stubbed.
jest.mock('electron', () => ({
    shell: {
        showItemInFolder: jest.fn(),
    },
    app: {
        isReady: jest.fn(() => true),
        getPath: jest.fn(() => ''),
    },
    powerMonitor: {
        getSystemIdleTime: jest.fn(() => 0),
    },
    session: {
        defaultSession: {},
    },
    systemPreferences: {
        getMediaAccessStatus: jest.fn(() => 'granted'),
    },
    Notification: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
    })),
}));

jest.mock('app/mainWindow/mainWindow', () => ({}));
jest.mock('common/config', () => ({
    configFilePath: 'mock/config/filepath/',
}));

describe('main/diagnostics/index', () => {
    it('should be initialized with correct values', () => {
        const d = Diagnostics;
        expect(d.stepTotal).toBe(0);
        expect(d.stepCurrent).toBe(0);
        expect(d.report).toEqual([]);
    });

    it('should count the steps correctly', () => {
        const d = Diagnostics;
        expect(d.getStepCount()).toBe(12);
    });
});
