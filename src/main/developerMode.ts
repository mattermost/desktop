// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ipcMain} from 'electron';
import isDev from 'electron-is-dev';
import {EventEmitter} from 'events';

import {DEVELOPER_MODE_UPDATED, IS_DEVELOPER_MODE_ENABLED, UPDATE_PATHS} from 'common/communication';
import JsonFileManager from 'common/JsonFileManager';
import {developerModeJson} from 'main/constants';

import type {DeveloperSettings} from 'types/settings';

export class DeveloperMode extends EventEmitter {
    private json: JsonFileManager<DeveloperSettings>;

    constructor(file: string) {
        super();
        this.json = new JsonFileManager(file);

        ipcMain.handle(IS_DEVELOPER_MODE_ENABLED, this.enabled);
    }

    enabled = () => process.env.MM_DESKTOP_DEVELOPER_MODE === 'true' || isDev;

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

    switchOff = (
        setting: keyof DeveloperSettings,
        onStart: () => void,
        onStop: () => void,
    ) => {
        if (!this.get(setting)) {
            onStart();
        }

        this.on(DEVELOPER_MODE_UPDATED, (settings: DeveloperSettings) => {
            if (typeof settings[setting] !== 'undefined') {
                if (settings[setting]) {
                    onStop();
                } else {
                    onStart();
                }
            }
        });
    };
}

let developerMode = new DeveloperMode(developerModeJson);
ipcMain.on(UPDATE_PATHS, () => {
    ipcMain.removeHandler(IS_DEVELOPER_MODE_ENABLED);
    developerMode = new DeveloperMode(developerModeJson);
});
export default developerMode;
