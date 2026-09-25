// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const {BROWSER_HISTORY_PUSH} = require('common/communication');

const mockOn = jest.fn();
const mockOff = jest.fn();
const mockExposeInMainWorld = jest.fn();

process.getCPUUsage = jest.fn().mockReturnValue({percentCPUUsage: 0});

global.document = {
    body: {classList: {add: jest.fn(), remove: jest.fn()}},
    activeElement: null,
    fullscreenElement: null,
};

jest.mock('electron', () => ({
    contextBridge: {exposeInMainWorld: mockExposeInMainWorld, executeInMainWorld: jest.fn()},
    ipcRenderer: {
        on: mockOn,
        off: mockOff,
        send: jest.fn(),
        invoke: jest.fn(),
        removeAllListeners: jest.fn(),
    },
    webFrame: {clearCache: jest.fn()},
}));

describe('externalAPI onBrowserHistoryPush', () => {
    let desktopAPI;

    beforeEach(() => {
        jest.resetModules();
        mockOn.mockClear();
        mockOff.mockClear();
        mockExposeInMainWorld.mockClear();
        global.window = {addEventListener: jest.fn(), desktopAPI: {}};
        require('./externalAPI');
        desktopAPI = mockExposeInMainWorld.mock.calls.find(([name]) => name === 'desktopAPI')?.[1];
    });

    it('registers one listener on the first call', () => {
        desktopAPI.onBrowserHistoryPush(jest.fn());
        const calls = mockOn.mock.calls.filter(([ch]) => ch === BROWSER_HISTORY_PUSH);
        expect(calls).toHaveLength(1);
    });

    it('does not add a second listener when a second caller registers', () => {
        desktopAPI.onBrowserHistoryPush(jest.fn());
        desktopAPI.onBrowserHistoryPush(jest.fn());
        const calls = mockOn.mock.calls.filter(([ch]) => ch === BROWSER_HISTORY_PUSH);
        expect(calls).toHaveLength(1);
    });

    it('delivers the event to all registered callbacks', () => {
        const cb1 = jest.fn();
        const cb2 = jest.fn();
        desktopAPI.onBrowserHistoryPush(cb1);
        desktopAPI.onBrowserHistoryPush(cb2);

        const handler = mockOn.mock.calls.find(([ch]) => ch === BROWSER_HISTORY_PUSH)[1];
        handler({}, '/some/path');

        expect(cb1).toHaveBeenCalledWith('/some/path');
        expect(cb2).toHaveBeenCalledWith('/some/path');
    });

    it('removes only the unsubscribed callback, leaving others active', () => {
        const cb1 = jest.fn();
        const cb2 = jest.fn();
        const remove1 = desktopAPI.onBrowserHistoryPush(cb1);
        desktopAPI.onBrowserHistoryPush(cb2);

        remove1();

        const handler = mockOn.mock.calls.find(([ch]) => ch === BROWSER_HISTORY_PUSH)[1];
        handler({}, '/some/path');

        expect(cb1).not.toHaveBeenCalled();
        expect(cb2).toHaveBeenCalledWith('/some/path');
    });

    it('removes the listener when the last callback unsubscribes', () => {
        const remove = desktopAPI.onBrowserHistoryPush(jest.fn());
        remove();
        expect(mockOff).toHaveBeenCalledWith(BROWSER_HISTORY_PUSH, expect.any(Function));
    });

    it('does not remove the listener when only one of multiple callbacks unsubscribes', () => {
        const remove1 = desktopAPI.onBrowserHistoryPush(jest.fn());
        desktopAPI.onBrowserHistoryPush(jest.fn());
        remove1();
        expect(mockOff).not.toHaveBeenCalled();
    });

    it('allows re-registration after all callbacks unsubscribe', () => {
        const remove = desktopAPI.onBrowserHistoryPush(jest.fn());
        remove();
        desktopAPI.onBrowserHistoryPush(jest.fn());
        const calls = mockOn.mock.calls.filter(([ch]) => ch === BROWSER_HISTORY_PUSH);
        expect(calls).toHaveLength(2);
    });

    it('calling unsubscribe twice does not remove a subsequent registration', () => {
        const remove = desktopAPI.onBrowserHistoryPush(jest.fn());
        remove(); // first unsubscribe — listener removed, Set empty
        const newCb = jest.fn();
        desktopAPI.onBrowserHistoryPush(newCb); // new registration
        remove(); // stale call — must not affect the new registration
        expect(mockOff).toHaveBeenCalledTimes(1); // only the first remove fired ipcRenderer.off

        // verify the new registration's callback still receives events
        const handler = mockOn.mock.calls.filter(([ch]) => ch === BROWSER_HISTORY_PUSH).at(-1)[1];
        handler({}, '/some/path');
        expect(newCb).toHaveBeenCalledWith('/some/path');
    });
});
