// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, nativeImage} from 'electron';

import * as Badge from './badge';
import MainWindow from './windows/mainWindow';

jest.mock('electron', () => ({
    app: {
        dock: {
            setBadge: jest.fn(),
        },
    },
    nativeImage: {
        createFromDataURL: jest.fn(),
    },
}));

jest.mock('common/appState', () => ({
    emitStatus: jest.fn(),
}));
jest.mock('./windows/mainWindow', () => ({
    get: jest.fn(),
}));

jest.mock('main/i18nManager', () => ({
    localizeMessage: jest.fn().mockReturnValue(''),
}));

describe('main/badge', () => {
    describe('showBadgeWindows', () => {
        const window = {
            setOverlayIcon: jest.fn(),
            webContents: {
                executeJavaScript: jest.fn(),
            },
        };
        let promise;

        beforeEach(() => {
            window.webContents.executeJavaScript.mockImplementation((code) => {
                promise = new Promise((resolve) => resolve(code));
                return promise;
            });
            nativeImage.createFromDataURL.mockImplementation((url) => url);
            Badge.setUnreadBadgeSetting(false);
            MainWindow.get.mockReturnValue(window);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should show exclamation when session expired', async () => {
            Badge.showBadgeWindows(true, 0, false);
            await promise;
            expect(window.setOverlayIcon).toBeCalledWith(expect.stringContaining('window.drawBadge(\'!\', false)'), expect.any(String));
        });

        it('should show mention count when has mention count', async () => {
            Badge.showBadgeWindows(true, 50, false);
            await promise;
            expect(window.setOverlayIcon).toBeCalledWith(expect.stringContaining('window.drawBadge(\'50\', false)'), expect.any(String));
        });

        it('should show 99+ when has mention count over 99', async () => {
            Badge.showBadgeWindows(true, 200, false);
            await promise;
            expect(window.setOverlayIcon).toBeCalledWith(expect.stringContaining('window.drawBadge(\'99+\', true)'), expect.any(String));
        });

        it('should not show dot when has unreads but setting is off', async () => {
            Badge.showBadgeWindows(false, 0, true);
            await promise;
            expect(window.setOverlayIcon).toBeCalledWith(null, expect.any(String));
        });

        it('should show dot when has unreads', async () => {
            Badge.setUnreadBadgeSetting(true);
            Badge.showBadgeWindows(false, 0, true);
            await promise;
            expect(window.setOverlayIcon).toBeCalledWith(expect.stringContaining('window.drawBadge(\'•\', false)'), expect.any(String));
        });
    });

    describe('showBadgeOSX', () => {
        beforeEach(() => {
            Badge.setUnreadBadgeSetting(false);
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should show exclamation when session expired', () => {
            Badge.showBadgeOSX(true, 0, false);
            expect(app.dock.setBadge).toBeCalledWith('!');
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
