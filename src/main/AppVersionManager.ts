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

    get installId(): string | undefined {
        try {
            const existing = this.getValue('installId');
            if (existing) {
                return existing;
            }

            const generated = uuid();
            this.setValue('installId', generated).catch((e) => {
                log.warn('failed to persist installId, a new one will be generated next launch', e);
            });
            return generated;
        } catch (e) {
            log.warn('failed to resolve installId', e);
            return undefined;
        }
    }
}

let appVersionManager = new AppVersionManager(appVersionJson);
export default appVersionManager;

ipcMain.on(UPDATE_PATHS, () => {
    appVersionManager = new AppVersionManager(appVersionJson);
});
