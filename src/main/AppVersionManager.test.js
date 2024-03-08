// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

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

describe('main/AppVersionManager', () => {
    it('should wipe out JSON file when validation fails', () => {
        fs.readFileSync.mockReturnValue('some bad JSON');
        Validator.validateAppState.mockReturnValue(false);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const appVersionManager = new AppVersionManager('somefilename.txt');

        expect(fs.writeFile).toBeCalledWith('somefilename.txt', '{}', expect.any(Function));
    });
});
