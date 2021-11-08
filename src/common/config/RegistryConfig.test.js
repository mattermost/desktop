// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import RegistryConfig from 'common/config/RegistryConfig';

jest.mock('winreg-utf8', () => {
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
                } else if (hive === 'really-bad-hive') {
                    throw new Error('This is an error');
                } else {
                    fn('Error', []);
                }
            },
        };
    });
});

jest.mock('electron-log', () => ({
    error: jest.fn(),
}));

describe('common/config/RegistryConfig', () => {
    describe('getRegistryEntryValues', () => {
        it('should return correct values', () => {
            const registryConfig = new RegistryConfig();
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key')).resolves.toStrictEqual([
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
            const registryConfig = new RegistryConfig();
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', 'correct-key-name-1')).resolves.toBe('correct-key-value-1');
        });

        it('should return undefined with wrong name', () => {
            const registryConfig = new RegistryConfig();
            expect(registryConfig.getRegistryEntryValues('correct-hive', 'correct-key', 'wrong-key-name-1')).resolves.toBe(undefined);
        });

        it('should return undefined with bad hive', () => {
            const registryConfig = new RegistryConfig();
            expect(registryConfig.getRegistryEntryValues('bad-hive', 'correct-key')).resolves.toBe(undefined);
        });

        it('should call reject when an error occurs', () => {
            const registryConfig = new RegistryConfig();
            expect(registryConfig.getRegistryEntryValues('really-bad-hive', 'correct-key')).rejects.toThrow(new Error('This is an error'));
        });
    });
});
