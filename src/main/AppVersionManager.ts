// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import {ipcMain} from 'electron';
import {v4 as uuid} from 'uuid';

import {UPDATE_PATHS} from 'common/communication';
import JsonFileManager from 'common/JsonFileManager';
import {Logger} from 'common/log';
import * as Validator from 'common/Validator';
import {appVersionJson} from 'main/constants';

import type {AppState} from 'types/appState';

const log = new Logger('AppVersionManager');

export class AppVersionManager extends JsonFileManager<AppState> {
    constructor(file: string) {
        super(file);

        this.init();
    }
    init = () => {
        // ensure data loaded from file is valid
        const validatedJSON = Validator.validateAppState(this.json);
        if (!validatedJSON) {
            this.setJson({});
        }

        if (!this.getValue('installId')) {
            // SentryHandler reads the install ID synchronously during startup, well before this
            // write lands, so a launch that fails to persist one still reports under it and won't
            // reuse it next time. Left alone deliberately: an install that can't write
            // app-state.json has bigger problems than a rotating ID.
            this.setValue('installId', uuid()).catch((e) => {
                log.warn('failed to persist install ID, the next launch will generate another', e);
            });
        }
    };

    set lastAppVersion(version) {
        this.setValue('lastAppVersion', version);
    }

    get lastAppVersion() {
        return this.getValue('lastAppVersion');
    }

    set skippedVersion(version) {
        this.setValue('skippedVersion', version);
    }

    get skippedVersion() {
        return this.getValue('skippedVersion');
    }

    set updateCheckedDate(date) {
        this.setValue('updateCheckedDate', date?.toISOString());
    }

    get updateCheckedDate() {
        const date = this.getValue('updateCheckedDate');
        if (date) {
            return new Date(date);
        }
        return null;
    }

    get installId() {
        return this.getValue('installId');
    }
}

let appVersionManager = new AppVersionManager(appVersionJson);
export default appVersionManager;

ipcMain.on(UPDATE_PATHS, () => {
    appVersionManager = new AppVersionManager(appVersionJson);
});
