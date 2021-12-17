// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import JsonFileManager from 'common/JsonFileManager';

import {migrationInfoPath} from 'main/constants';

import {Config, MigrationInfo} from 'types/config';

export default function migrateConfigItems(config: Config) {
    const migrationPrefs = new JsonFileManager<MigrationInfo>(migrationInfoPath);
    let didMigrate = false;

    if (!migrationPrefs.getValue('updateTrayIconWin32') && process.platform === 'win32') {
        config.trayIconTheme = 'use_system';
        migrationPrefs.setValue('updateTrayIconWin32', true);
        didMigrate = true;
    }

    return didMigrate;
}
