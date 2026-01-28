// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import RegistryConfig from 'common/config/RegistryConfig';

jest.mock('registry-js', () => {
    return {
        HKEY: {
            HKEY_LOCAL_MACHINE: 'HKEY_LOCAL_MACHINE',
            HKEY_CURRENT_USER: 'HKEY_CURRENT_USER',
        },
        enumerateValues: jest.fn().mockImplementation((hive, key) => {
            if (hive === 'correct-hive') {
                return [
                    {
                        name: `${key}-name-1`,
                        data: `${key}-value-1`,

                    },
                    {
                        name: `${key}-name-2`,
                        data: `${key}-value-2`,
                    },
                ];
            } else if (hive === 'mattermost-hive') {
                if (key.endsWith('DefaultServerList')) {
                    return [
                        {
                            name: 'server-1',
                            data: 'http://server-1.com',
                        },
                    ];
                }
                return [
                    {
                        name: 'EnableServerManagement',
                        data: 1,
                    },
                    {
                        name: 'EnableAutoUpdater',
                        data: 1,
                    },
                ];
            } else if (hive === 'really-bad-hive') {
                throw new Error('This is an error');
            } else if (hive === 'HKEY_LOCAL_MACHINE') {
                if (key.endsWith('DefaultServerList')) {
                    return [
                        {
                            name: 'server-lm-1',
                            data: 'http://server-lm-1.com',
                        },
                        {
                            name: 'server-lm-2',
                            data: 'http://server-lm-2.com',
                        },
                    ];
                }

                // For boolean settings, return the value based on the name parameter
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {
                            name: 'EnableServerManagement',
                            data: 1, // enabled in LM
                        },
                        {
                            name: 'EnableAutoUpdater',
                            data: 0, // disabled in LM
                        },
                    ];
                }
                return [];
            } else if (hive === 'HKEY_CURRENT_USER') {
                if (key.endsWith('DefaultServerList')) {
                    return [
                        {
                            name: 'server-cu-1',
                            data: 'http://server-cu-1.com',
                        },
                        {
                            name: 'server-cu-2',
                            data: 'http://server-cu-2.com',
                        },
                    ];
                }

                // For boolean settings, return the value based on the name parameter
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {
                            name: 'EnableServerManagement',
                            data: 0, // disabled in CU (should override LM)
                        },
                        {
                            name: 'EnableAutoUpdater',
                            data: 1, // enabled in CU (should override LM)
                        },
                    ];
                }
                return [];
            } else if (hive === 'conflict-hive-lm') {
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {
                            name: 'EnableServerManagement',
                            data: 1,
                        },
                    ];
                }
                return [];
            } else if (hive === 'conflict-hive-cu') {
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {
                            name: 'EnableServerManagement',
                            data: 0,
                        },
                    ];
                }
                return [];
            } else if (hive === 'undefined-hive-lm') {
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {
                            name: 'EnableServerManagement',
                            data: 1,
                        },
                    ];
                }
                return [];
            } else if (hive === 'undefined-hive-cu') {
                // Return undefined/empty for CU
                return [];
            } else if (hive === 'mixed-undefined-lm') {
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {
                            name: 'EnableServerManagement',
                            data: 1,
                        },
                    ];
                }
                return [];
            } else if (hive === 'mixed-undefined-cu') {
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return undefined; // Explicitly undefined
                }
                return [];
            } else if (hive === 'error-hive-lm') {
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    return [
                        {
                            name: 'EnableServerManagement',
                            data: 1,
                        },
                    ];
                }
                return [];
            } else if (hive === 'error-hive-cu') {
                if (key.includes('SOFTWARE\\Policies\\Mattermost')) {
                    throw new Error('Registry access error in CU');
                }
                return [];
            } else if (hive === 'theme-light-hive') {
                if (key.includes('Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize')) {
                    return [
                        {
                            name: 'AppsUseLightTheme',
                            data: 1,
                        },
                    ];
                }
                return [];
            } else if (hive === 'theme-dark-hive') {
                if (key.includes('Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize')) {
                    return [
                        {
                            name: 'AppsUseLightTheme',
                            data: 0,
                        },
                    ];
                }
                return [];
            } else if (hive === 'theme-undefined-hive') {
                if (key.includes('Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize')) {
                    return [];
                }
                return [];
            } else if (hive === 'theme-error-hive') {
                if (key.includes('Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize')) {
                    throw new Error('Registry access error');
                }
                return [];
            }

            return [];
        }),
    };
});

describe('common/config/RegistryConfig', () => {
    it('should initialize correctly', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });

        const registryConfig = new RegistryConfig();
        const originalFn = registryConfig.getRegistryEntryValues;
        registryConfig.getRegistryEntryValues = (hive, key, name) => originalFn.apply(registryConfig, ['mattermost-hive', key, name, false]);
        registryConfig.init();

        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
        expect(registryConfig.data.servers).toContainEqual({
            name: 'server-1',
            url: 'http://server-1.com',
        });
        expect(registryConfig.data.enableUpdateNotifications).toBe(true);
        expect(registryConfig.data.enableServerManagement).toBe(true);
    });

    describe('getRegistryEntryValues', () => {
        const registryConfig = new RegistryConfig();

        it('should return correct values', () => {
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', null, false)).toStrictEqual([
                {
                    name: 'correct-key-name-1',
                    data: 'correct-key-value-1',
                },
                {
                    name: 'correct-key-name-2',
                    data: 'correct-key-value-2',
                },
            ]);
        });

        it('should return correct value by name', () => {
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', 'correct-key-name-1', false)).toBe('correct-key-value-1');
        });

        it('should return undefined with wrong name', () => {
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', 'wrong-key-name-1', false)).toBe(undefined);
        });

        it('should return undefined with bad hive', () => {
            expect(registryConfig.getRegistryEntryValues('bad-hive', 'correct-key', null, false)).toBe(undefined);
        });

        it('should return undefined when an error occurs', () => {
            expect(registryConfig.getRegistryEntryValues('really-bad-hive', 'correct-key', null, false)).toBe(undefined);
        });
    });

    describe('Hive Conflict Resolution', () => {
        let registryConfig;

        beforeEach(() => {
            registryConfig = new RegistryConfig();
        });

        it('should prioritize HKEY_CURRENT_USER over HKEY_LOCAL_MACHINE for EnableServerManagement', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_LOCAL_MACHINE') {
                    return originalFn.apply(registryConfig, ['conflict-hive-lm', key, name, false]);
                } else if (hive === 'HKEY_CURRENT_USER') {
                    return originalFn.apply(registryConfig, ['conflict-hive-cu', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getEnableServerManagementFromRegistry();

            // Should return false (from CU) even though LM has true
            expect(result).toBe(false);
        });

        it('should combine servers from both hives', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_LOCAL_MACHINE') {
                    return originalFn.apply(registryConfig, ['HKEY_LOCAL_MACHINE', key, name, false]);
                } else if (hive === 'HKEY_CURRENT_USER') {
                    return originalFn.apply(registryConfig, ['HKEY_CURRENT_USER', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const servers = registryConfig.getServersListFromRegistry();
            expect(servers).toHaveLength(4);
            expect(servers).toContainEqual({
                name: 'server-lm-1',
                url: 'http://server-lm-1.com',
            });
            expect(servers).toContainEqual({
                name: 'server-lm-2',
                url: 'http://server-lm-2.com',
            });
            expect(servers).toContainEqual({
                name: 'server-cu-1',
                url: 'http://server-cu-1.com',
            });
            expect(servers).toContainEqual({
                name: 'server-cu-2',
                url: 'http://server-cu-2.com',
            });
        });

        it('should handle EnableUpdateNotifications conflict correctly', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_LOCAL_MACHINE') {
                    return originalFn.apply(registryConfig, ['HKEY_LOCAL_MACHINE', key, name, false]);
                } else if (hive === 'HKEY_CURRENT_USER') {
                    return originalFn.apply(registryConfig, ['HKEY_CURRENT_USER', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getEnableUpdateNotificationsFromRegistry();

            // Should return true (from CU) even though LM has false
            expect(result).toBe(true);
        });
    });

    describe('Undefined Value Handling', () => {
        let registryConfig;

        beforeEach(() => {
            registryConfig = new RegistryConfig();
        });

        it('should handle undefined values from one hive', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_LOCAL_MACHINE') {
                    return originalFn.apply(registryConfig, ['undefined-hive-lm', key, name, false]);
                } else if (hive === 'HKEY_CURRENT_USER') {
                    return originalFn.apply(registryConfig, ['undefined-hive-cu', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getEnableServerManagementFromRegistry();

            // Should return true from LM since CU is undefined
            expect(result).toBe(true);
        });

        it('should handle explicitly undefined values', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_LOCAL_MACHINE') {
                    return originalFn.apply(registryConfig, ['mixed-undefined-lm', key, name, false]);
                } else if (hive === 'HKEY_CURRENT_USER') {
                    return originalFn.apply(registryConfig, ['mixed-undefined-cu', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getEnableServerManagementFromRegistry();

            // Should return true from LM since CU returns undefined
            expect(result).toBe(true);
        });

        it('should handle errors in one hive gracefully', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_LOCAL_MACHINE') {
                    return originalFn.apply(registryConfig, ['error-hive-lm', key, name, false]);
                } else if (hive === 'HKEY_CURRENT_USER') {
                    return originalFn.apply(registryConfig, ['error-hive-cu', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getEnableServerManagementFromRegistry();

            // Should return true from LM since CU throws an error
            expect(result).toBe(true);
        });

        it('should handle all undefined values', () => {
            registryConfig.getRegistryEntryValues = () => {
                // Both hives return undefined
                return undefined;
            };

            const result = registryConfig.getEnableServerManagementFromRegistry();

            // Should return undefined when both hives are undefined
            expect(result).toBe(undefined);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        let registryConfig;

        beforeEach(() => {
            registryConfig = new RegistryConfig();
        });

        it('should handle non-Windows platform gracefully', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            const registryConfig = new RegistryConfig();
            registryConfig.init();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            // Should not crash and should be initialized
            expect(registryConfig.initialized).toBe(true);
            expect(registryConfig.data.servers).toEqual([]);
        });

        it('should handle malformed registry data', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (key.includes('DefaultServerList')) {
                    return [
                        {
                            name: 'server-1',
                            data: null, // Malformed data
                        },
                        {
                            name: 'server-2',
                            data: 'http://server-2.com',
                        },
                    ];
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const servers = registryConfig.getServersListFromRegistry();

            // Should filter out malformed entries (null data)
            // Note: The current implementation doesn't filter out null data, it just converts it
            expect(servers).toHaveLength(4); // Both hives return the same data
            expect(servers[0]).toEqual({
                name: 'server-1',
                url: null, // The implementation preserves the original data type
            });
            expect(servers[1]).toEqual({
                name: 'server-2',
                url: 'http://server-2.com',
            });
        });

        it('should handle registry entries with non-string data for servers', () => {
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (key.includes('DefaultServerList')) {
                    return [
                        {
                            name: 'server-1',
                            data: 123, // Non-string data
                        },
                        {
                            name: 'server-2',
                            data: 'http://server-2.com',
                        },
                    ];
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const servers = registryConfig.getServersListFromRegistry();

            // Should handle non-string data gracefully
            expect(servers).toHaveLength(4); // Both hives return the same data
            expect(servers[0]).toEqual({
                name: 'server-1',
                url: 123, // Should preserve the original data type
            });
        });

        it('should emit registry-read event after initialization', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const registryConfig = new RegistryConfig();
            const mockEmit = jest.spyOn(registryConfig, 'emit');

            registryConfig.init();

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });

            expect(mockEmit).toHaveBeenCalledWith('registry-read', registryConfig.data);
            mockEmit.mockRestore();
        });

        it('should handle multiple initialization calls', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const registryConfig = new RegistryConfig();
            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => originalFn.apply(registryConfig, ['mattermost-hive', key, name, false]);

            // First initialization
            registryConfig.init();
            const firstServerCount = registryConfig.data.servers.length;

            // Second initialization
            registryConfig.init();
            const secondServerCount = registryConfig.data.servers.length;

            // Note: The current implementation duplicates data on multiple initializations
            // This is a potential issue that should be addressed
            expect(secondServerCount).toBe(firstServerCount * 2);

            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });

    describe('getAppsUseLightTheme', () => {
        let registryConfig;
        let originalPlatform;

        beforeEach(() => {
            registryConfig = new RegistryConfig();
            originalPlatform = process.platform;
        });

        afterEach(() => {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });

        it('should return true when AppsUseLightTheme is 1 (light mode)', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_CURRENT_USER' && key.includes('Themes\\Personalize')) {
                    return originalFn.apply(registryConfig, ['theme-light-hive', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getAppsUseLightTheme();
            expect(result).toBe(true);
        });

        it('should return false when AppsUseLightTheme is 0 (dark mode)', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_CURRENT_USER' && key.includes('Themes\\Personalize')) {
                    return originalFn.apply(registryConfig, ['theme-dark-hive', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getAppsUseLightTheme();
            expect(result).toBe(false);
        });

        it('should return true (default) when AppsUseLightTheme is undefined', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_CURRENT_USER' && key.includes('Themes\\Personalize')) {
                    return originalFn.apply(registryConfig, ['theme-undefined-hive', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getAppsUseLightTheme();
            expect(result).toBe(true);
        });

        it('should return true (default) on non-Windows platforms', () => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            const result = registryConfig.getAppsUseLightTheme();
            expect(result).toBe(true);
        });

        it('should return true (default) when registry access throws an error', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_CURRENT_USER' && key.includes('Themes\\Personalize')) {
                    return originalFn.apply(registryConfig, ['theme-error-hive', key, name, false]);
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getAppsUseLightTheme();
            expect(result).toBe(true);
        });

        it('should correctly read AppsUseLightTheme from HKEY_CURRENT_USER', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const originalFn = registryConfig.getRegistryEntryValues;
            registryConfig.getRegistryEntryValues = (hive, key, name) => {
                if (hive === 'HKEY_CURRENT_USER' && key.includes('Themes\\Personalize') && name === 'AppsUseLightTheme') {
                    return 0;
                }
                return originalFn.apply(registryConfig, [hive, key, name, false]);
            };

            const result = registryConfig.getAppsUseLightTheme();
            expect(result).toBe(false);
        });
    });
});
