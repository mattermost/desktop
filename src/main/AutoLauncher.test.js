// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AutoLaunch from 'auto-launch';

import {AutoLauncher} from './AutoLauncher';

jest.mock('auto-launch', () => jest.fn());
jest.mock('electron', () => ({
    app: {
        name: 'Mattermost',
    },
}));

jest.mock('electron-is-dev', () => false);

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn(),
}));

describe('main/AutoLauncher', () => {
    let autoLauncher;
    const isEnabled = jest.fn();
    const enable = jest.fn();
    const disable = jest.fn();

    beforeEach(() => {
        AutoLaunch.mockImplementation(() => ({
            isEnabled,
            enable,
            disable,
        }));
        autoLauncher = new AutoLauncher();
    });

    it('should toggle enabled/disabled', async () => {
        isEnabled.mockReturnValue(true);
        await autoLauncher.enable();
        expect(enable).not.toBeCalled();

        isEnabled.mockReturnValue(false);
        await autoLauncher.enable();
        expect(enable).toBeCalled();

        isEnabled.mockReturnValue(false);
        await autoLauncher.disable();
        expect(disable).not.toBeCalled();

        isEnabled.mockReturnValue(true);
        await autoLauncher.disable();
        expect(disable).toBeCalled();
    });
});

