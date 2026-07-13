// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Config from 'common/config';

import {registerMainWindowE2EReadiness} from 'main/e2e/appReady';

jest.mock('common/config', () => ({
    hideOnStart: false,
}));

describe('main/e2e/appReady', () => {
    afterEach(() => {
        delete global.__e2eAppReady;
        Config.hideOnStart = false;
    });

    const makeWindow = (visible) => {
        const listeners = {};
        return {
            isDestroyed: () => false,
            isVisible: () => visible,
            once: jest.fn((event, cb) => {
                listeners[event] = cb;
            }),
            webContents: {
                getURL: () => 'mattermost-desktop://renderer/index.html',
                once: jest.fn((event, cb) => {
                    listeners[`wc:${event}`] = cb;
                }),
            },
            fire: (event) => listeners[event]?.(),
            fireWebContents: (event) => listeners[`wc:${event}`]?.(),
        };
    };

    it('should mark ready on show when hideOnStart is false', () => {
        const win = makeWindow(false);
        registerMainWindowE2EReadiness(win);

        expect(global.__e2eAppReady).toBeUndefined();
        expect(win.once).toHaveBeenCalledWith('show', expect.any(Function));
        expect(win.webContents.once).not.toHaveBeenCalled();

        win.fire('show');
        expect(global.__e2eAppReady).toBe(true);
    });

    it('should mark ready on index did-finish-load when hideOnStart is true', () => {
        Config.hideOnStart = true;
        const win = makeWindow(false);
        registerMainWindowE2EReadiness(win);

        expect(win.webContents.once).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
        win.fireWebContents('did-finish-load');
        expect(global.__e2eAppReady).toBe(true);
    });
});
