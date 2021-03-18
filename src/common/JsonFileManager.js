// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';

export default class JsonFileManager {
    constructor(file) {
        this.jsonFile = file;
        try {
            this.json = JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch (err) {
            this.json = {};
        }
    }

    writeToFile() {
        fs.writeFile(this.jsonFile, JSON.stringify(this.json, null, 2), (err) => {
            if (err) {
                // No real point in bringing electron-log into this otherwise electron-free file
                // eslint-disable-next-line no-console
                console.error(err);
            }
        });
    }

    setJson(json) {
        this.json = json;
        this.writeToFile();
    }

    setValue(key, value) {
        this.json[key] = value;
        this.writeToFile();
    }

    getValue(key) {
        return this.json[key];
    }
}
