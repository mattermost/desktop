// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import RegistryConfig from 'common/config/RegistryConfig';

jest.mock('winreg', () => {
    return jest.fn().mockImplementation(({hive, key}) => {
        return {
            values: (fn) => {
                if (hive === 'correct-hive') {
                    fn(null, [
                        {
                            name: `${key}-name-1`,
                            value: `${key}-value-1`,

                        },
                        {
                            name: `${key}-name-2`,
                            value: `${key}-value-2`,
                        },
                    ]);
                } else if (hive === 'mattermost-hive') {
                    if (key.endsWith('DefaultServerList')) {
                        fn(null, [
                            {
                                name: 'server-1',
                                value: 'http://server-1.com',
                            },
                        ]);
                    } else {
                        fn(null, [
                            {
                                name: 'EnableServerManagement',
                                value: '0x1',
                            },
                            {
                                name: 'EnableAutoUpdater',
                                value: '0x1',
                            },
                        ]);
                    }
                } else if (hive === 'really-bad-hive') {
                    throw new Error('This is an error');
                } else {
                    fn('Error', []);
                }
            },
        };
    });
});

describe('common/config/RegistryConfig', () => {
    it('should initialize correctly', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });

        const registryConfig = new RegistryConfig();
        const originalFn = registryConfig.getRegistryEntryValues;
        registryConfig.getRegistryEntryValues = (hive, key, name) => originalFn.apply(registryConfig, ['mattermost-hive', key, name, false]);
        await registryConfig.init();

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
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', null, false)).resolves.toStrictEqual([
                {
                    name: 'correct-key-name-1',
                    value: 'correct-key-value-1',
                },
                {
                    name: 'correct-key-name-2',
                    value: 'correct-key-value-2',
                },
            ]);
        });

        it('should return correct value by name', () => {
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', 'correct-key-name-1', false)).resolves.toBe('correct-key-value-1');
        });

        it('should return undefined with wrong name', () => {
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', 'wrong-key-name-1', false)).resolves.toBe(undefined);
        });

        it('should return undefined with bad hive', () => {
            expect(registryConfig.getRegistryEntryValues('bad-hive', 'correct-key', null, false)).resolves.toBe(undefined);
        });

        it('should call reject when an error occurs', () => {
            expect(registryConfig.getRegistryEntryValues('really-bad-hive', 'correct-key', null, false)).rejects.toThrow(new Error('This is an error'));
        });
    });
});
