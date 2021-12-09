// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import * as Validator from 'main/Validator';

import {AppVersionManager} from './AppVersionManager';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFile: jest.fn(),
}));

jest.mock('main/Validator', () => ({
    validateAppState: jest.fn(),
}));

describe('main/AppVersionManager', () => {
    it('should wipe out JSON file when validation fails', () => {
        fs.readFileSync.mockReturnValue('some bad JSON');
        Validator.validateAppState.mockReturnValue(false);

        // eslint-disable-next-line no-unused-vars
        const appVersionManager = new AppVersionManager('somefilename.txt');

        expect(fs.writeFile).toBeCalledWith('somefilename.txt', '{}', expect.any(Function));
    });
});
