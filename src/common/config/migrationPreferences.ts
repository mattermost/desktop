// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app} from 'electron';

import {Config, MigrationInfo} from 'types/config';

import JsonFileManager from 'common/JsonFileManager';

export default function migrateConfigItems(config: Config) {
    const migrationPrefs = new JsonFileManager<MigrationInfo>(path.resolve(app.getPath('userData'), 'migration-info.json'));
    let didMigrate = false;

    if (!migrationPrefs.getValue('updateTrayIconWin32') && process.platform === 'win32') {
        config.trayIconTheme = 'use_system';
        migrationPrefs.setValue('updateTrayIconWin32', true);
        didMigrate = true;
    }

    return didMigrate;
}
