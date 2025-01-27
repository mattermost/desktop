// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DeveloperMode} from './developerMode';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFile: jest.fn(),
}));

jest.mock('electron', () => ({
    ipcMain: {
        on: jest.fn(),
        handle: jest.fn(),
    },
}));

jest.mock('electron-is-dev', () => false);

describe('main/developerMode', () => {
    it('should toggle values correctly', () => {
        const developerMode = new DeveloperMode('file.json');

        // Should be false unless developer mode is enabled
        developerMode.toggle('setting1');
        expect(developerMode.get('setting1')).toBe(false);

        developerMode.enabled = () => true;

        developerMode.toggle('setting1');
        expect(developerMode.get('setting1')).toBe(true);

        developerMode.toggle('setting1');
        expect(developerMode.get('setting1')).toBe(false);
    });
});
