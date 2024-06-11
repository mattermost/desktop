// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getFocusAssist, isPriority} from 'windows-focus-assist';

import doNotDisturb from './dnd-windows';

jest.mock('windows-focus-assist', () => ({
    getFocusAssist: jest.fn(),
    isPriority: jest.fn(),
}));

describe('main/notifications/dnd-windows', () => {
    it('should return false if unsupported, failed, or off', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });

        getFocusAssist.mockReturnValue({value: 0});
        expect(doNotDisturb()).toBe(false);
        getFocusAssist.mockReturnValue({value: -1});
        expect(doNotDisturb()).toBe(false);
        getFocusAssist.mockReturnValue({value: -2});
        expect(doNotDisturb()).toBe(false);

        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    it('should return true if alarms only', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });

        getFocusAssist.mockReturnValue({value: 2});
        expect(doNotDisturb()).toBe(true);

        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    it('should check if the app is priority if priority only', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });

        getFocusAssist.mockReturnValue({value: 1});
        isPriority.mockReturnValue({value: 0});
        expect(doNotDisturb()).toBe(true);
        isPriority.mockReturnValue({value: 1});
        expect(doNotDisturb()).toBe(false);

        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });
});
