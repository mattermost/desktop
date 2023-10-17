// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import JsonFileManager from 'common/JsonFileManager';

import migrateConfigItems from './migrationPreferences';

jest.mock('common/JsonFileManager', () => jest.fn());

describe('common/config/migrationPreferences', () => {
    describe('migrateConfigItems', () => {
        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should not migrate if all items migrated', () => {
            JsonFileManager.mockImplementation(() => ({
                getValue: () => true,
            }));
            expect(migrateConfigItems({})).toBe(false);
        });

        it('should migrate if items are not migrated', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });
            JsonFileManager.mockImplementation(() => ({
                getValue: () => false,
                setValue: jest.fn(),
            }));
            expect(migrateConfigItems({teams: []})).toBe(true);
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        });
    });
});
