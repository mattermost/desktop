// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app} from 'electron';

import * as Badge from './badge';

import {setOverlayIcon} from './windows/windowManager';

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

describe('main/badge', () => {
    describe('showBadgeWindows', () => {
        it('should show dot when session expired', () => {
            Badge.showBadgeWindows(true, 7, false);
            expect(setOverlayIcon).toBeCalledWith('•', expect.any(String), expect.any(Boolean));
        });

        it('should show mention count when has mention count', () => {
            Badge.showBadgeWindows(false, 50, false);
            expect(setOverlayIcon).toBeCalledWith('50', expect.any(String), false);
        });

        it('should show 99+ when has mention count over 99', () => {
            Badge.showBadgeWindows(false, 200, false);
            expect(setOverlayIcon).toBeCalledWith('99+', expect.any(String), true);
        });

        it('should not show dot when has unreads but setting is off', () => {
            Badge.showBadgeWindows(false, 0, true);
            expect(setOverlayIcon).not.toBeCalledWith('•', expect.any(String), expect.any(Boolean));
        });

        it('should show dot when has unreads', () => {
            Badge.setUnreadBadgeSetting(true);
            Badge.showBadgeWindows(false, 0, true);
            expect(setOverlayIcon).toBeCalledWith('•', expect.any(String), expect.any(Boolean));
            Badge.setUnreadBadgeSetting(false);
        });
    });

    describe('showBadgeOSX', () => {
        it('should show dot when session expired', () => {
            Badge.showBadgeOSX(true, 7, false);
            expect(app.dock.setBadge).toBeCalledWith('•');
        });

        it('should show mention count when has mention count', () => {
            Badge.showBadgeOSX(false, 50, false);
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
