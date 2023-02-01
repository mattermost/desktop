// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app} from 'electron';

import * as Badge from './badge';

import WindowManager from './windows/windowManager';

jest.mock('electron', () => ({
    app: {
        dock: {
            setBadge: jest.fn(),
        },
    },
}));

jest.mock('./appState', () => ({
    updateBadge: jest.fn(),
}));

jest.mock('./windows/windowManager', () => ({
    setOverlayIcon: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn().mockReturnValue(''),
}));

describe('main/badge', () => {
    describe('showBadgeWindows', () => {
        it('should show dot when session expired', () => {
            Badge.showBadgeWindows(true, 0, false);
            expect(WindowManager.setOverlayIcon).toBeCalledWith('•', expect.any(String), expect.any(Boolean));
        });

        it('should show mention count when has mention count', () => {
            Badge.showBadgeWindows(true, 50, false);
            expect(WindowManager.setOverlayIcon).toBeCalledWith('50', expect.any(String), false);
        });

        it('should show 99+ when has mention count over 99', () => {
            Badge.showBadgeWindows(true, 200, false);
            expect(WindowManager.setOverlayIcon).toBeCalledWith('99+', expect.any(String), true);
        });

        it('should not show dot when has unreads but setting is off', () => {
            Badge.showBadgeWindows(false, 0, true);
            expect(WindowManager.setOverlayIcon).not.toBeCalledWith('•', expect.any(String), expect.any(Boolean));
        });

        it('should show dot when has unreads', () => {
            Badge.setUnreadBadgeSetting(true);
            Badge.showBadgeWindows(false, 0, true);
            expect(WindowManager.setOverlayIcon).toBeCalledWith('•', expect.any(String), expect.any(Boolean));
            Badge.setUnreadBadgeSetting(false);
        });
    });

    describe('showBadgeOSX', () => {
        it('should show dot when session expired', () => {
            Badge.showBadgeOSX(true, 0, false);
            expect(app.dock.setBadge).toBeCalledWith('•');
        });

        it('should show mention count when has mention count', () => {
            Badge.showBadgeOSX(true, 50, false);
            expect(app.dock.setBadge).toBeCalledWith('50');
        });

        it('should not show dot when has unreads but setting is off', () => {
            Badge.showBadgeOSX(false, 0, true);
            expect(app.dock.setBadge).not.toBeCalledWith('•');
        });

        it('should show dot when has unreads', () => {
            Badge.setUnreadBadgeSetting(true);
            Badge.showBadgeOSX(false, 0, true);
            expect(app.dock.setBadge).toBeCalledWith('•');
        });
    });
});
