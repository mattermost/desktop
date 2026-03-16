// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const mockExec = jest.fn();
jest.mock('child_process', () => ({
    exec: mockExec,
}));

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(),
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

function mockExecResolveByPattern(mapping) {
    mockExec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === 'function') {
            cb = opts;
        }
        if (typeof cb !== 'function') {
            return;
        }
        for (const [pattern, stdout] of Object.entries(mapping)) {
            if (cmd.includes(pattern)) {
                cb(null, {stdout, stderr: ''});
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

    describe('getInstalledBrowsers - macOS', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
        });

        it('should detect installed browsers via mdfind', async () => {
            mockExecResolveByPattern({
                'com.google.Chrome': '/Applications/Google Chrome.app',
                'com.apple.Safari': '/Applications/Safari.app',
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(2);
            expect(browsers[0].name).toBe('Safari');
            expect(browsers[0].command).toBe('open -b "com.apple.Safari"');
            expect(browsers[1].name).toBe('Google Chrome');
            expect(browsers[1].command).toBe('open -b "com.google.Chrome"');
        });

        it('should handle mdfind errors gracefully', async () => {
            mockExecReject(new Error('mdfind failed'));

            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });
    });

    describe('getInstalledBrowsers - Windows', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
        });

        it('should detect installed browsers via registry', async () => {
            mockExecResolveByPattern({
                'Google Chrome': '    (Default)    REG_SZ    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
                'FIREFOX.EXE': '    (Default)    REG_SZ    "C:\\Program Files\\Mozilla Firefox\\firefox.exe"',
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(2);
            expect(browsers[0].name).toBe('Google Chrome');
            expect(browsers[0].command).toBe('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"');
            expect(browsers[1].name).toBe('Firefox');
        });

        it('should handle registry errors gracefully', async () => {
            mockExecReject(new Error('registry not found'));

            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });
    });

    describe('getInstalledBrowsers - Linux', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'linux'});
        });

        it('should detect installed browsers via which', async () => {
            mockExec.mockImplementation((cmd, opts, cb) => {
                if (typeof opts === 'function') {
                    cb = opts;
                }
                if (typeof cb !== 'function') {
                    return;
                }
                if (cmd === 'which firefox') {
                    cb(null, {stdout: '/usr/bin/firefox', stderr: ''});
                } else if (cmd === 'which google-chrome') {
                    cb(null, {stdout: '/usr/bin/google-chrome', stderr: ''});
                } else if (cmd.startsWith('grep')) {
                    cb(null, {stdout: '', stderr: ''});
                } else {
                    cb(new Error('not found'));
                }
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(2);
            expect(browsers[0].name).toBe('Firefox');
            expect(browsers[0].command).toBe('firefox');
            expect(browsers[1].name).toBe('Google Chrome');
            expect(browsers[1].command).toBe('google-chrome');
        });

        it('should handle which errors gracefully', async () => {
            mockExec.mockImplementation((cmd, opts, cb) => {
                if (typeof opts === 'function') {
                    cb = opts;
                }
                if (typeof cb !== 'function') {
                    return;
                }
                if (cmd.startsWith('grep')) {
                    cb(null, {stdout: '', stderr: ''});
                } else {
                    cb(new Error('not found'));
                }
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });
    });

    describe('getInstalledBrowsers - unsupported platform', () => {
        it('should return empty array', async () => {
            Object.defineProperty(process, 'platform', {value: 'freebsd'});
            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });
    });

    describe('caching', () => {
        it('should cache browser results across calls', async () => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            mockExecResolveByPattern({
                'com.apple.Safari': '/Applications/Safari.app',
            });

            await getInstalledBrowsers();
            mockExec.mockClear();
            const browsers = await getInstalledBrowsers();
            expect(mockExec).not.toHaveBeenCalled();
            expect(browsers.length).toBe(1);
        });
    });

    describe('openLinkInBrowser', () => {
        it('should open link using the browser command', async () => {
            mockExecResolve('');

            const browser = {name: 'Google Chrome', command: 'open -b "com.google.Chrome"'};
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

            const browser = {name: 'Chrome', command: 'open -b "com.google.Chrome"'};
            await openLinkInBrowser('https://example.com', browser);

            expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
        });
    });
});
