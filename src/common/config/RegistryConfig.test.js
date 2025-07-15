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
                        data: '0x1',
                    },
                    {
                        name: 'EnableAutoUpdater',
                        data: '0x1',
                    },
                ];
            } else if (hive === 'really-bad-hive') {
                throw new Error('This is an error');
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
        expect(registryConfig.data.enableAutoUpdater).toBe(true);
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
});
