// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import JsonFileManager from 'common/JsonFileManager';
import {TAB_MESSAGING} from 'common/views/View';
import {migrationInfoPath} from 'main/constants';

import type {Config, MigrationInfo} from 'types/config';

export default function migrateConfigItems(config: Config) {
    const migrationPrefs = new JsonFileManager<MigrationInfo>(migrationInfoPath);
    let didMigrate = false;

    if (!migrationPrefs.getValue('updateTrayIconWin32') && process.platform === 'win32') {
        config.trayIconTheme = 'use_system';
        migrationPrefs.setValue('updateTrayIconWin32', true);
        didMigrate = true;
    }

    if (!migrationPrefs.getValue('closeExtraTabs')) {
        config.teams.forEach((team) => {
            team.tabs.filter((tab) => tab.name !== TAB_MESSAGING).forEach((tab) => {
                tab.isOpen = false;
            });
        });
        migrationPrefs.setValue('closeExtraTabs', true);
        didMigrate = true;
    }

    if (!migrationPrefs.getValue('enableMetrics')) {
        config.enableMetrics = true;
        migrationPrefs.setValue('enableMetrics', true);
        didMigrate = true;
    }

    return didMigrate;
}
