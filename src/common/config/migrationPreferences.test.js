// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import JsonFileManager from 'common/JsonFileManager';

import migrateConfigItems, {migratePermissions} from './migrationPreferences';

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

    describe('migratePermissions', () => {
        it('should not migrate if there is no screenShare permission', () => {
            const permissions = {
                'http://server-1.com': {media: {allowed: true}, 'display-capture': {allowed: true}},
            };
            expect(migratePermissions(permissions)).toBe(false);
            expect(permissions).toEqual({
                'http://server-1.com': {media: {allowed: true}, 'display-capture': {allowed: true}},
            });
        });

        it('should move screenShare to display-capture', () => {
            const permissions = {
                'http://server-1.com': {media: {allowed: true}, screenShare: {allowed: true}},
                'http://server-2.com': {screenShare: {allowed: false, alwaysDeny: true}},
                'http://server-3.com': {media: {allowed: true}},
            };
            expect(migratePermissions(permissions)).toBe(true);
            expect(permissions).toEqual({
                'http://server-1.com': {media: {allowed: true}, 'display-capture': {allowed: true}},
                'http://server-2.com': {'display-capture': {allowed: false, alwaysDeny: true}},
                'http://server-3.com': {media: {allowed: true}},
            });
        });

        it('should not touch migration-info.json', () => {
            migratePermissions({'http://server-1.com': {screenShare: {allowed: true}}});
            expect(JsonFileManager).not.toHaveBeenCalled();
        });
    });
});
