// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const {BROWSER_HISTORY_PUSH} = require('common/communication');

const mockOn = jest.fn();
const mockOff = jest.fn();

jest.mock('electron', () => ({
    contextBridge: {exposeInMainWorld: jest.fn()},
    ipcRenderer: {
        on: mockOn,
        off: mockOff,
        send: jest.fn(),
        invoke: jest.fn(),
    },
}));

describe('externalAPI onBrowserHistoryPush', () => {
    let desktopAPI;

    beforeEach(() => {
        jest.resetModules();
        mockOn.mockClear();
        mockOff.mockClear();
        desktopAPI = require('./externalAPI').desktopAPI;
    });

    it('registers the listener on the first call', () => {
        desktopAPI.onBrowserHistoryPush(jest.fn());
        expect(mockOn).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, expect.any(Function));
    });

    it('does not register a second listener when already registered', () => {
        desktopAPI.onBrowserHistoryPush(jest.fn());
        desktopAPI.onBrowserHistoryPush(jest.fn());
        const calls = mockOn.mock.calls.filter(([ch]) => ch === BROWSER_HISTORY_PUSH);
        expect(calls).toHaveLength(1);
    });

    it('returns a no-op unsubscribe for the second caller', () => {
        desktopAPI.onBrowserHistoryPush(jest.fn());
        const remove = desktopAPI.onBrowserHistoryPush(jest.fn());
        remove();
        expect(mockOff).not.toHaveBeenCalled();
    });

    it('allows re-registration after the first caller unsubscribes', () => {
        const remove = desktopAPI.onBrowserHistoryPush(jest.fn());
        remove();
        desktopAPI.onBrowserHistoryPush(jest.fn());
        const calls = mockOn.mock.calls.filter(([ch]) => ch === BROWSER_HISTORY_PUSH);
        expect(calls).toHaveLength(2);
    });
});
