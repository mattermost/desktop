// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

import {Logger} from 'common/log';

const log = new Logger('JsonFileManager');

export default class JsonFileManager<T> {
    jsonFile: string;
    json: T;

    // Why the file couldn't be used, when `json` is the empty fallback. Callers can't otherwise tell a missing
    // file or a syntax error apart from a file that really was `{}`.
    loadError?: unknown;
    private saving?: Promise<void>;

    constructor(file: string) {
        this.jsonFile = file;
        try {
            this.json = JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch (err) {
            this.json = {} as T;
            this.loadError = err;
        }
    }

    write(json: string): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.jsonFile, json, (err) => {
                if (err) {
                    // No real point in bringing electron-log into this otherwise electron-free file
                    // eslint-disable-next-line no-console
                    console.error(err);
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    writeToFile(): Promise<void> {
        log.debug('writeToFile', this.jsonFile);

        const json = JSON.stringify(this.json, undefined, 2);
        if (this.saving) {
            this.saving = this.saving.then(() => this.write(json));
        } else {
            this.saving = this.write(json);
        }
        return this.saving;
    }

    setJson(json: T): Promise<void> {
        this.json = json;
        return this.writeToFile();
    }

    setValue(key: keyof T, value: T[keyof T]): Promise<void> {
        this.json[key] = value;
        return this.writeToFile();
    }

    getValue(key: keyof T): T[keyof T] {
        return this.json[key];
    }
}
