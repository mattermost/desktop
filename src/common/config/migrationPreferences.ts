// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import JsonFileManager from 'common/JsonFileManager';
import {migrationInfoPath} from 'main/constants';

import type {CurrentConfig, MigrationInfo} from 'types/config';

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
