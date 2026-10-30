// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import JsonFileManager from 'common/JsonFileManager';
import {migrationInfoPath} from 'main/constants';

import type {CurrentConfig, MigrationInfo} from 'types/config';
import type {Permissions} from 'types/permissions';

export default function migrateConfigItems(config: CurrentConfig) {
    const migrationPrefs = new JsonFileManager<MigrationInfo>(migrationInfoPath);
    let didMigrate = false;

    if (!migrationPrefs.getValue('updateTrayIconWin32') && process.platform === 'win32') {
        config.trayIconTheme = 'use_system';
        migrationPrefs.setValue('updateTrayIconWin32', true);
        didMigrate = true;
    }

    if (!migrationPrefs.getValue('enableMetrics')) {
        config.enableMetrics = true;
        migrationPrefs.setValue('enableMetrics', true);
        didMigrate = true;
    }

    return didMigrate;
}

// Electron reports screen capture requests as `display-capture`, so the permission saved as `screenShare` is renamed to match.
// This is safe to repeat, so it doesn't set a migration-info.json flag: writing that file here races with migrateConfigItems on a fresh install.
export function migratePermissions(permissions: Record<string, Permissions>) {
    let didMigrate = false;

    for (const originPermissions of Object.values(permissions)) {
        if (originPermissions?.screenShare) {
            originPermissions['display-capture'] = originPermissions.screenShare;
            delete originPermissions.screenShare;
            didMigrate = true;
        }
    }

    return didMigrate;
}
