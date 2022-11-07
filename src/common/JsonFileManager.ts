// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

export default class JsonFileManager<T> {
    jsonFile: string;
    json: T;

    constructor(file: string) {
        this.jsonFile = file;
        try {
            this.json = JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch (err) {
            this.json = {} as T;
        }
    }

    writeToFile(): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.jsonFile, JSON.stringify(this.json, undefined, 2), (err) => {
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

    setJson(json: T): void {
        this.json = json;
        this.writeToFile();
    }

    setValue(key: keyof T, value: T[keyof T]): void {
        this.json[key] = value;
        this.writeToFile();
    }

    getValue(key: keyof T): T[keyof T] {
        return this.json[key];
    }
}
