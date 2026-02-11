// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPreferenceValue as getCFPreferenceValue} from 'cf-prefs';
import {enumerateValues} from 'registry-js';

import policyConfigLoader from 'common/config/policyConfigLoader';

jest.mock('registry-js', () => {
    return {
        HKEY: {
            HKEY_LOCAL_MACHINE: 'HKEY_LOCAL_MACHINE',
            HKEY_CURRENT_USER: 'HKEY_CURRENT_USER',
        },
        enumerateValues: jest.fn().mockImplementation((hive, key) => {
            if (hive === 'HKEY_LOCAL_MACHINE') {
                if (key.endsWith('DefaultServerList')) {
                    return [
                        {name: 'server-lm-1', data: 'http://server-lm-1.com'},
                        {name: 'server-lm-2', data: 'http://server-lm-2.com'},
                    ];
                }
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {name: 'EnableServerManagement', data: 1},
                        {name: 'EnableAutoUpdater', data: 0},
                    ];
                }
                return [];
            }
            if (hive === 'HKEY_CURRENT_USER') {
                if (key.endsWith('DefaultServerList')) {
                    return [
                        {name: 'server-cu-1', data: 'http://server-cu-1.com'},
                        {name: 'server-cu-2', data: 'http://server-cu-2.com'},
                    ];
                }
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {name: 'EnableServerManagement', data: 0},
                        {name: 'EnableAutoUpdater', data: 1},
                    ];
                }
                return [];
            }
            if (key.includes('Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize')) {
                return [{name: 'AppsUseLightTheme', data: 1}];
            }
            return [];
        }),
    };
});

jest.mock('cf-prefs', () => ({
    getPreferenceValue: jest.fn().mockImplementation((key) => {
        if (key === 'DefaultServerList') {
            return [
                {name: 'server-a', url: 'https://a.com'},
                {name: 'server-b', url: 'https://b.com'},
            ];
        }
        if (key === 'EnableServerManagement') {
            return true;
        }
        if (key === 'EnableAutoUpdater') {
            return false;
        }
        return undefined;
    }),
}));

describe('common/config/policyConfigLoader', () => {
    let originalPlatform;

    beforeEach(() => {
        originalPlatform = process.platform;
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {value: originalPlatform});
    });

    describe('getPolicyConfig', () => {
        describe('Windows', () => {
            beforeEach(() => {
                Object.defineProperty(process, 'platform', {value: 'win32'});
            });

            it('returns merged servers from both hives and CU overrides LM for booleans', () => {
                const data = policyConfigLoader.getPolicyConfig();
                expect(data.servers).toHaveLength(4);
                expect(data.servers).toContainEqual({name: 'server-lm-1', url: 'http://server-lm-1.com'});
                expect(data.servers).toContainEqual({name: 'server-cu-1', url: 'http://server-cu-1.com'});
                expect(data.enableServerManagement).toBe(false);
                expect(data.enableUpdateNotifications).toBe(true);
            });

            it('handles undefined from one hive', () => {
                enumerateValues.mockImplementation((hive, key) => {
                    if (key.includes('Mattermost') && !key.includes('DefaultServerList')) {
                        return hive === 'HKEY_LOCAL_MACHINE' ? [{name: 'EnableServerManagement', data: 1}] : [];
                    }
                    return [];
                });
                const data = policyConfigLoader.getPolicyConfig();
                expect(data.enableServerManagement).toBe(true);
            });

            it('handles registry error in one hive', () => {
                enumerateValues.mockImplementation((hive, key) => {
                    if (key.includes('Mattermost') && hive === 'HKEY_CURRENT_USER') {
                        throw new Error('Registry access error');
                    }
                    if (key.includes('Mattermost') && !key.includes('DefaultServerList')) {
                        return [{name: 'EnableServerManagement', data: 1}];
                    }
                    if (key.endsWith('DefaultServerList')) {
                        return hive === 'HKEY_LOCAL_MACHINE' ? [{name: 's', data: 'http://s.com'}] : [];
                    }
                    return [];
                });
                const data = policyConfigLoader.getPolicyConfig();
                expect(data.enableServerManagement).toBe(true);
                expect(data.servers).toHaveLength(1);
            });

            it('handles malformed server data', () => {
                enumerateValues.mockImplementation((hive, key) => {
                    if (key.endsWith('DefaultServerList')) {
                        return [
                            {name: 'server-1', data: null},
                            {name: 'server-2', data: 'http://server-2.com'},
                        ];
                    }
                    return [];
                });
                const data = policyConfigLoader.getPolicyConfig();
                expect(data.servers.length).toBeGreaterThanOrEqual(2);
                expect(data.servers[0]).toEqual({name: 'server-1', url: null});
                expect(data.servers[1]).toEqual({name: 'server-2', url: 'http://server-2.com'});
            });

            it('returns consistent data from multiple calls', () => {
                const first = policyConfigLoader.getPolicyConfig();
                const second = policyConfigLoader.getPolicyConfig();
                expect(second.servers).toHaveLength(first.servers.length);
                expect(second.enableServerManagement).toBe(first.enableServerManagement);
            });
        });

        describe('macOS', () => {
            beforeEach(() => {
                Object.defineProperty(process, 'platform', {value: 'darwin'});
            });

            it('returns servers and booleans from managed preferences', () => {
                const data = policyConfigLoader.getPolicyConfig();
                expect(data.servers).toEqual([
                    {name: 'server-a', url: 'https://a.com'},
                    {name: 'server-b', url: 'https://b.com'},
                ]);
                expect(data.enableServerManagement).toBe(true);
                expect(data.enableUpdateNotifications).toBe(false);
            });

            it('returns empty servers and undefined booleans when no managed prefs', () => {
                getCFPreferenceValue.mockImplementation(() => undefined);
                const data = policyConfigLoader.getPolicyConfig();
                expect(data.servers).toEqual([]);
                expect(data.enableServerManagement).toBeUndefined();
                expect(data.enableUpdateNotifications).toBeUndefined();
            });

            it('handles cf-prefs throw gracefully', () => {
                getCFPreferenceValue.mockImplementation((key) => {
                    if (key === 'DefaultServerList') {
                        throw new Error('cf-prefs error');
                    }
                    return undefined;
                });
                const data = policyConfigLoader.getPolicyConfig();
                expect(data.servers).toEqual([]);
            });
        });
    });

    describe('getAppsUseLightTheme', () => {
        it('returns true when AppsUseLightTheme is 1 on Windows', () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            enumerateValues.mockImplementation((hive, key) => {
                if (key.includes('Themes\\Personalize')) {
                    return [{name: 'AppsUseLightTheme', data: 1}];
                }
                return [];
            });
            expect(policyConfigLoader.getAppsUseLightTheme()).toBe(true);
        });

        it('returns false when AppsUseLightTheme is 0 on Windows', () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            enumerateValues.mockImplementation((hive, key) => {
                if (key.includes('Themes\\Personalize')) {
                    return [{name: 'AppsUseLightTheme', data: 0}];
                }
                return [];
            });
            expect(policyConfigLoader.getAppsUseLightTheme()).toBe(false);
        });

        it('returns true when registry key missing on Windows', () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            enumerateValues.mockImplementation(() => []);
            expect(policyConfigLoader.getAppsUseLightTheme()).toBe(true);
        });

        it('returns true on non-Windows', () => {
            Object.defineProperty(process, 'platform', {value: 'darwin'});
            expect(policyConfigLoader.getAppsUseLightTheme()).toBe(true);
        });

        it('returns true when registry access throws on Windows', () => {
            Object.defineProperty(process, 'platform', {value: 'win32'});
            enumerateValues.mockImplementation((hive, key) => {
                if (key.includes('Themes\\Personalize')) {
                    throw new Error('Registry error');
                }
                return [];
            });
            expect(policyConfigLoader.getAppsUseLightTheme()).toBe(true);
        });
    });
});
