// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import JsonFileManager from 'common/JsonFileManager';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFile: jest.fn(),
}));

jest.mock('common/log', () => ({
    Logger: jest.fn(() => ({debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()})),
}));

describe('common/JsonFileManager', () => {
    describe('constructor', () => {
        it('should load valid JSON without recording a load error', () => {
            fs.readFileSync.mockReturnValue('{"version": 4}');

            const manager = new JsonFileManager('/fake/config.json');

            expect(manager.json).toStrictEqual({version: 4});
            expect(manager.loadError).toBeUndefined();
        });

        it('should fall back to an empty object and keep the JSON syntax error when the file is malformed', () => {
            fs.readFileSync.mockReturnValue('{"a": [1]\n  "b": 2}');

            const manager = new JsonFileManager('/fake/config.json');

            expect(manager.json).toStrictEqual({});
            expect(manager.loadError).toBeInstanceOf(SyntaxError);
        });

        it('should fall back to an empty object and keep the read error when the file cannot be read', () => {
            const readError = Object.assign(new Error('ENOENT: no such file or directory'), {code: 'ENOENT'});
            fs.readFileSync.mockImplementation(() => {
                throw readError;
            });

            const manager = new JsonFileManager('/fake/config.json');

            expect(manager.json).toStrictEqual({});
            expect(manager.loadError).toBe(readError);
        });
    });
});
