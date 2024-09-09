// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';
import {EventEmitter} from 'events';

import {DEVELOPER_MODE_UPDATED, UPDATE_PATHS} from 'common/communication';
import JsonFileManager from 'common/JsonFileManager';
import {developerModeJson} from 'main/constants';

import type {DeveloperSettings} from 'types/settings';

export class DeveloperMode extends EventEmitter {
    private json: JsonFileManager<DeveloperSettings>;

    constructor(file: string) {
        super();
        this.json = new JsonFileManager(file);
    }

    enabled = () => process.env.MM_DESKTOP_DEVELOPER_MODE === 'true';

    toggle = (setting: keyof DeveloperSettings) => {
        if (!this.enabled()) {
            return;
        }

        this.json.setValue(setting, !this.json.getValue(setting));
        this.emit(DEVELOPER_MODE_UPDATED, {[setting]: this.json.getValue(setting)});
    };

    get = (setting: keyof DeveloperSettings) => {
        if (!this.enabled()) {
            return false;
        }

        return this.json.getValue(setting);
    };
}

let developerMode = new DeveloperMode(developerModeJson);
ipcMain.on(UPDATE_PATHS, () => {
    developerMode = new DeveloperMode(developerModeJson);
});
export default developerMode;
