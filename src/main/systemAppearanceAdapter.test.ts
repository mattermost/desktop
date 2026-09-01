// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {systemPreferences} from 'electron';

import {createSystemAppearanceAdapter} from 'main/systemAppearanceAdapter';

jest.mock('electron', () => ({
    systemPreferences: {
        getUserDefault: jest.fn(),
        subscribeNotification: jest.fn(() => 7),
        unsubscribeNotification: jest.fn(),
    },
}));

describe('createSystemAppearanceAdapter', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
        jest.mocked(systemPreferences.subscribeNotification).mockReturnValue(7);
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {value: originalPlatform});
        jest.clearAllMocks();
    });

    it('returns unsupported outside macOS', async () => {
        Object.defineProperty(process, 'platform', {value: 'linux'});

        await expect(createSystemAppearanceAdapter().read()).resolves.toEqual({status: 'unknown', reason: 'unsupported'});
    });

    it.each([
        ['', {status: 'known', value: 'light'}],
        ['Dark', {status: 'known', value: 'dark'}],
        ['Unexpected', {status: 'unknown', reason: 'invalid'}],
    ])('normalizes the macOS value %p', async (value, expected) => {
        Object.defineProperty(process, 'platform', {value: 'darwin'});
        jest.mocked(systemPreferences.getUserDefault).mockReturnValue(value);
        const adapter = createSystemAppearanceAdapter();
        adapter.subscribeInvalidation(jest.fn());

        await expect(adapter.read()).resolves.toEqual(expected);
    });

    it('is unavailable when live invalidation cannot be subscribed', async () => {
        Object.defineProperty(process, 'platform', {value: 'darwin'});
        jest.mocked(systemPreferences.subscribeNotification).mockImplementationOnce(() => {
            throw new Error('unavailable');
        });
        const adapter = createSystemAppearanceAdapter();
        adapter.subscribeInvalidation(jest.fn());

        await expect(adapter.read()).resolves.toEqual({status: 'unknown', reason: 'unavailable'});
        expect(systemPreferences.getUserDefault).not.toHaveBeenCalled();
    });

    it('turns the macOS notification into an invalidation subscription', () => {
        Object.defineProperty(process, 'platform', {value: 'darwin'});
        const invalidate = jest.fn();
        const unsubscribe = createSystemAppearanceAdapter().subscribeInvalidation(invalidate);

        expect(systemPreferences.subscribeNotification).toHaveBeenCalledWith('AppleInterfaceThemeChangedNotification', invalidate);
        unsubscribe();
        expect(systemPreferences.unsubscribeNotification).toHaveBeenCalledWith(7);
    });
});
