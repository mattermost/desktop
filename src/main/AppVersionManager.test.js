// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';
import {v4 as uuid} from 'uuid';

import * as Validator from 'common/Validator';

import {AppVersionManager} from './AppVersionManager';

jest.mock('electron', () => ({
    ipcMain: {
        on: jest.fn(),
    },
}));

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFile: jest.fn(),
}));

jest.mock('common/Validator', () => ({
    validateAppState: jest.fn(),
}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
}));

describe('main/AppVersionManager', () => {
    it('should wipe out JSON file when validation fails', () => {
        fs.readFileSync.mockReturnValue('some bad JSON');
        Validator.validateAppState.mockReturnValue(false);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const appVersionManager = new AppVersionManager('somefilename.txt');

        expect(fs.writeFile).toBeCalledWith('somefilename.txt', '{}', expect.any(Function));
    });

    describe('installId', () => {
        beforeEach(() => {
            Validator.validateAppState.mockReturnValue(true);
        });

        it('should generate and persist an install ID when none exists', () => {
            fs.readFileSync.mockReturnValue('{}');
            fs.writeFile.mockImplementation((file, data, callback) => callback(null));

            const appVersionManager = new AppVersionManager('somefilename.txt');

            expect(appVersionManager.installId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
            expect(fs.writeFile).toBeCalledWith(
                'somefilename.txt',
                expect.stringContaining('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
                expect.any(Function),
            );
        });

        it('should reuse a persisted install ID without rewriting the file', () => {
            fs.readFileSync.mockReturnValue(JSON.stringify({installId: 'existing-id'}));
            fs.writeFile.mockImplementation((file, data, callback) => callback(null));

            const appVersionManager = new AppVersionManager('somefilename.txt');
            fs.writeFile.mockClear();

            expect(appVersionManager.installId).toBe('existing-id');
            expect(fs.writeFile).not.toBeCalled();
        });

        it('should generate the install ID only once', () => {
            fs.readFileSync.mockReturnValue('{}');
            fs.writeFile.mockImplementation((file, data, callback) => callback(null));

            const appVersionManager = new AppVersionManager('somefilename.txt');

            expect(appVersionManager.installId).toBe(appVersionManager.installId);
            expect(uuid).toBeCalledTimes(1);
        });

        it('should still return an ID when persisting it fails', async () => {
            fs.readFileSync.mockReturnValue('{}');
            fs.writeFile.mockImplementation((file, data, callback) => callback(new Error('disk full')));

            const appVersionManager = new AppVersionManager('somefilename.txt');

            expect(appVersionManager.installId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');

            // A rejected write must not surface as an unhandled rejection.
            await new Promise((resolve) => setImmediate(resolve));
        });
    });
});
