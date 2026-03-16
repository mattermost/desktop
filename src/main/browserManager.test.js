// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const mockExec = jest.fn();
jest.mock('child_process', () => ({
    exec: mockExec,
}));

jest.mock('electron', () => ({
    shell: {
        openExternal: jest.fn(),
    },
}));

jest.mock('common/log', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        debug: jest.fn(),
        error: jest.fn(),
    })),
}));

function mockExecResolve(stdout) {
    mockExec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === 'function') {
            cb = opts;
        }
        if (typeof cb === 'function') {
            cb(null, {stdout, stderr: ''});
        }
    });
}

function mockExecResolveByBundleId(mapping) {
    mockExec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === 'function') {
            cb = opts;
        }
        if (typeof cb !== 'function') {
            return;
        }
        for (const [bundleId, appPath] of Object.entries(mapping)) {
            if (cmd.includes(bundleId)) {
                cb(null, {stdout: appPath, stderr: ''});
                return;
            }
        }
        cb(null, {stdout: '', stderr: ''});
    });
}

function mockExecReject(error) {
    mockExec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === 'function') {
            cb = opts;
        }
        if (typeof cb === 'function') {
            cb(error);
        }
    });
}

describe('main/browserManager', () => {
    let getInstalledBrowsers;
    let openLinkInBrowser;
    let clearBrowserCache;
    const originalPlatform = process.platform;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        const browserManager = require('./browserManager');
        getInstalledBrowsers = browserManager.getInstalledBrowsers;
        openLinkInBrowser = browserManager.openLinkInBrowser;
        clearBrowserCache = browserManager.clearBrowserCache;
        clearBrowserCache();
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {value: originalPlatform});
    });

    describe('getInstalledBrowsers', () => {
        it('should return empty array on non-darwin platforms', async () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });

        it('should detect installed browsers on macOS', async () => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            mockExecResolveByBundleId({
                'com.google.Chrome': '/Applications/Google Chrome.app',
                'com.apple.Safari': '/Applications/Safari.app',
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(2);
            expect(browsers[0].name).toBe('Safari');
            expect(browsers[0].bundleId).toBe('com.apple.Safari');
            expect(browsers[1].name).toBe('Google Chrome');
            expect(browsers[1].bundleId).toBe('com.google.Chrome');
        });

        it('should cache browser results', async () => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            mockExecResolveByBundleId({
                'com.apple.Safari': '/Applications/Safari.app',
            });

            await getInstalledBrowsers();
            mockExec.mockClear();
            const browsers = await getInstalledBrowsers();
            expect(mockExec).not.toHaveBeenCalled();
            expect(browsers.length).toBe(1);
        });

        it('should handle mdfind errors gracefully', async () => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            mockExecReject(new Error('mdfind failed'));

            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });
    });

    describe('openLinkInBrowser', () => {
        it('should open link using the specified browser bundle ID', async () => {
            mockExecResolve('');

            const browser = {name: 'Google Chrome', path: '/Applications/Google Chrome.app', bundleId: 'com.google.Chrome'};
            await openLinkInBrowser('https://example.com', browser);

            expect(mockExec).toHaveBeenCalledWith(
                'open -b "com.google.Chrome" "https://example.com"',
                {timeout: 10000},
                expect.any(Function),
            );
        });

        it('should fall back to shell.openExternal on failure', async () => {
            const {shell} = require('electron');
            mockExecReject(new Error('App not found'));

            const browser = {name: 'Chrome', path: '/Applications/Google Chrome.app', bundleId: 'com.google.Chrome'};
            await openLinkInBrowser('https://example.com', browser);

            expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
        });
    });
});
