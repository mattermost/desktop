// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const mockExecFile = jest.fn();
const mockEnumerateValues = jest.fn();
jest.mock('child_process', () => ({
    execFile: mockExecFile,
}));

jest.mock('registry-js', () => ({
    HKEY: {
        HKEY_LOCAL_MACHINE: 'HKEY_LOCAL_MACHINE',
        HKEY_CURRENT_USER: 'HKEY_CURRENT_USER',
    },
    enumerateValues: (...args) => mockEnumerateValues(...args),
}));

const mockExistsSync = jest.fn(() => true);
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: (...args) => mockExistsSync(...args),
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

function resolveExecCallback(opts, callback) {
    if (typeof opts === 'function') {
        return opts;
    }
    return callback;
}

function mockExecFileResolve() {
    mockExecFile.mockImplementation((file, args, opts, callback) => {
        const cb = resolveExecCallback(opts, callback);
        if (typeof cb === 'function') {
            cb(null, {stdout: '', stderr: ''});
        }
    });
}

function mockExecFileReject(error) {
    mockExecFile.mockImplementation((file, args, opts, callback) => {
        const cb = resolveExecCallback(opts, callback);
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
        mockExistsSync.mockReturnValue(true);
        mockEnumerateValues.mockReturnValue([]);

        const browserManager = require('./browserManager').default;
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
            mockExecFile.mockImplementation((file, args, opts, callback) => {
                const cb = resolveExecCallback(opts, callback);
                if (typeof cb !== 'function') {
                    return;
                }

                const query = args[0];
                if (file === 'mdfind' && query.includes('com.google.Chrome')) {
                    cb(null, {stdout: '/Applications/Google Chrome.app\n', stderr: ''});
                    return;
                }
                if (file === 'mdfind' && query.includes('com.apple.Safari')) {
                    cb(null, {stdout: '/Applications/Safari.app\n', stderr: ''});
                    return;
                }

                cb(new Error('not found'));
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(2);
            expect(browsers[0].name).toBe('Safari');
            expect(browsers[0].executable).toBe('open');
            expect(browsers[0].args).toEqual(['-b', 'com.apple.Safari']);
            expect(browsers[1].name).toBe('Google Chrome');
            expect(browsers[1].executable).toBe('open');
            expect(browsers[1].args).toEqual(['-b', 'com.google.Chrome']);
        });

        it('should handle mdfind errors gracefully', async () => {
            mockExecFileReject(new Error('mdfind failed'));

            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });
    });

    describe('getInstalledBrowsers - Windows', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
        });

        it('should detect installed browsers via registry', async () => {
            mockEnumerateValues.mockImplementation((hive, key) => {
                if (hive === 'HKEY_LOCAL_MACHINE' && key.endsWith('Google Chrome\\shell\\open\\command')) {
                    return [{name: '', data: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'}];
                }
                if (hive === 'HKEY_LOCAL_MACHINE' && key.endsWith('FIREFOX.EXE\\shell\\open\\command')) {
                    return [{name: '', data: '"C:\\Program Files\\Mozilla Firefox\\firefox.exe"'}];
                }
                return [];
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(2);
            expect(browsers[0].name).toBe('Google Chrome');
            expect(browsers[0].executable).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
            expect(browsers[0].args).toEqual([]);
            expect(browsers[1].name).toBe('Firefox');
            expect(browsers[1].executable).toBe('C:\\Program Files\\Mozilla Firefox\\firefox.exe');
        });

        it('should skip browsers whose executable does not exist', async () => {
            mockEnumerateValues.mockImplementation((hive, key) => {
                if (hive === 'HKEY_LOCAL_MACHINE' && key.endsWith('Google Chrome\\shell\\open\\command')) {
                    return [{name: '', data: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'}];
                }
                if (hive === 'HKEY_LOCAL_MACHINE' && key.endsWith('FIREFOX.EXE\\shell\\open\\command')) {
                    return [{name: '', data: '"C:\\Program Files\\Mozilla Firefox\\firefox.exe"'}];
                }
                return [];
            });
            mockExistsSync.mockImplementation((p) => {
                if (p === 'C:\\Program Files\\Mozilla Firefox\\firefox.exe') {
                    return false;
                }
                return true;
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(1);
            expect(browsers[0].name).toBe('Google Chrome');
        });

        it('should check both HKLM and HKCU registries', async () => {
            mockEnumerateValues.mockImplementation((hive, key) => {
                if (hive === 'HKEY_CURRENT_USER' && key.endsWith('Google Chrome\\shell\\open\\command')) {
                    return [{name: '', data: '"C:\\Users\\user\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"'}];
                }
                return [];
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(1);
            expect(browsers[0].name).toBe('Google Chrome');
        });

        it('should parse registry command with flags, quoted args, and %1 placeholder', async () => {
            mockEnumerateValues.mockImplementation((hive, key) => {
                if (hive === 'HKEY_LOCAL_MACHINE' && key.endsWith('Google Chrome\\shell\\open\\command')) {
                    return [{name: '', data: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --profile "My Profile" %1'}];
                }
                return [];
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(1);
            expect(browsers[0].executable).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
            expect(browsers[0].args).toEqual(['--profile', 'My Profile']);
        });

        it('should filter out quoted placeholders like "%1"', async () => {
            mockEnumerateValues.mockImplementation((hive, key) => {
                if (hive === 'HKEY_LOCAL_MACHINE' && key.endsWith('Google Chrome\\shell\\open\\command')) {
                    return [{name: '', data: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --single-argument "%1"'}];
                }
                return [];
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(1);
            expect(browsers[0].executable).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
            expect(browsers[0].args).toEqual(['--single-argument']);
        });

        it('should parse unquoted registry command path', async () => {
            mockEnumerateValues.mockImplementation((hive, key) => {
                if (hive === 'HKEY_LOCAL_MACHINE' && key.endsWith('Google Chrome\\shell\\open\\command')) {
                    return [{name: '', data: 'C:\\Chrome\\chrome.exe'}];
                }
                return [];
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(1);
            expect(browsers[0].executable).toBe('C:\\Chrome\\chrome.exe');
            expect(browsers[0].args).toEqual([]);
        });

        it('should handle registry errors gracefully', async () => {
            mockEnumerateValues.mockImplementation(() => {
                throw new Error('registry not found');
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers).toEqual([]);
        });
    });

    describe('getInstalledBrowsers - Linux', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {value: 'linux'});
        });

        it('should detect installed browsers via which', async () => {
            mockExecFile.mockImplementation((file, args, opts, callback) => {
                const cb = resolveExecCallback(opts, callback);
                if (typeof cb !== 'function') {
                    return;
                }

                if (file !== 'which') {
                    cb(new Error('unexpected command'));
                    return;
                }

                if (args[0] === 'firefox') {
                    cb(null, {stdout: '/usr/bin/firefox\n', stderr: ''});
                    return;
                }
                if (args[0] === 'google-chrome') {
                    cb(null, {stdout: '/usr/bin/google-chrome\n', stderr: ''});
                    return;
                }

                cb(new Error('not found'));
            });

            const browsers = await getInstalledBrowsers();
            expect(browsers.length).toBe(2);
            expect(browsers[0].name).toBe('Firefox');
            expect(browsers[0].executable).toBe('/usr/bin/firefox');
            expect(browsers[0].args).toEqual([]);
            expect(browsers[1].name).toBe('Google Chrome');
            expect(browsers[1].executable).toBe('/usr/bin/google-chrome');
        });

        it('should handle which errors gracefully', async () => {
            mockExecFile.mockImplementation((file, args, opts, callback) => {
                const cb = resolveExecCallback(opts, callback);
                if (typeof cb === 'function') {
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
            mockExecFile.mockImplementation((file, args, opts, callback) => {
                const cb = resolveExecCallback(opts, callback);
                if (typeof cb !== 'function') {
                    return;
                }

                if (file === 'mdfind' && args[0].includes('com.apple.Safari')) {
                    cb(null, {stdout: '/Applications/Safari.app\n', stderr: ''});
                    return;
                }

                cb(new Error('not found'));
            });

            await getInstalledBrowsers();
            mockExecFile.mockClear();
            const browsers = await getInstalledBrowsers();
            expect(mockExecFile).not.toHaveBeenCalled();
            expect(browsers.length).toBe(1);
        });
    });

    describe('openLinkInBrowser', () => {
        it('should open link using execFile with browser executable and args', async () => {
            mockExecFileResolve();

            const browser = {name: 'Google Chrome', executable: 'open', args: ['-b', 'com.google.Chrome']};
            await openLinkInBrowser('https://example.com', browser);

            expect(mockExecFile).toHaveBeenCalledWith(
                'open',
                ['-b', 'com.google.Chrome', 'https://example.com'],
                {timeout: 10000},
                expect.any(Function),
            );
        });

        it('should pass URL as argument without shell interpolation', async () => {
            mockExecFileResolve();

            const browser = {name: 'Firefox', executable: '/usr/bin/firefox', args: []};
            const maliciousUrl = 'https://example.com/$(whoami)';
            await openLinkInBrowser(maliciousUrl, browser);

            expect(mockExecFile).toHaveBeenCalledWith(
                '/usr/bin/firefox',
                ['https://example.com/$(whoami)'],
                {timeout: 10000},
                expect.any(Function),
            );
        });

        it('should fall back to shell.openExternal on failure', async () => {
            const {shell} = require('electron');
            shell.openExternal.mockResolvedValue();
            mockExecFileReject(new Error('App not found'));

            const browser = {name: 'Chrome', executable: 'open', args: ['-b', 'com.google.Chrome']};
            await openLinkInBrowser('https://example.com', browser);

            expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
        });

        it('should catch shell.openExternal rejection gracefully', async () => {
            const {shell} = require('electron');
            shell.openExternal.mockRejectedValue(new Error('openExternal failed'));
            mockExecFileReject(new Error('App not found'));

            const browser = {name: 'Chrome', executable: 'open', args: ['-b', 'com.google.Chrome']};
            await expect(openLinkInBrowser('https://example.com', browser)).resolves.toBeUndefined();
        });
    });
});
