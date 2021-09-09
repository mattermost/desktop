// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import {AppState} from 'types/appState';

import JsonFileManager from '../common/JsonFileManager';

import * as Validator from './Validator';

export default class AppVersionManager extends JsonFileManager<AppState> {
    constructor(file: string) {
        super(file);

        // ensure data loaded from file is valid
        const validatedJSON = Validator.validateAppState(this.json);
        if (!validatedJSON) {
            this.setJson({});
        }
    }
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
}
