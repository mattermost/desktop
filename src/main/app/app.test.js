// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app, dialog} from 'electron';

import CertificateStore from 'main/certificateStore';
import WindowManager from 'main/windows/windowManager';

import {handleAppWillFinishLaunching, handleAppCertificateError, certificateErrorCallbacks} from 'main/app/app';
import {getDeeplinkingURL, openDeepLink} from 'main/app/utils';

jest.mock('electron', () => ({
    app: {
        on: jest.fn(),
        once: jest.fn(),
        isReady: jest.fn(),
    },
    dialog: {
        showMessageBox: jest.fn(),
    },
}));

jest.mock('main/app/utils', () => ({
    getDeeplinkingURL: jest.fn(),
    openDeepLink: jest.fn(),
}));
jest.mock('main/autoUpdater', () => ({}));

jest.mock('main/certificateStore', () => ({
    isExplicitlyUntrusted: jest.fn(),
    isTrusted: jest.fn(),
    isExisting: jest.fn(),
    add: jest.fn(),
    save: jest.fn(),
}));
jest.mock('main/tray/tray', () => ({}));
jest.mock('main/windows/windowManager', () => ({
    getMainWindow: jest.fn(),
}));

describe('main/app/app', () => {
    describe('handleAppWillFinishLaunching', () => {
        const deepLinkURL = 'mattermost://server-1.com';
        const testURL = 'http://server-1.com';

        beforeEach(() => {
            app.on.mockImplementation((event, cb) => {
                if (event === 'open-url') {
                    cb({preventDefault: jest.fn()}, deepLinkURL);
                }
            });
            getDeeplinkingURL.mockReturnValue(testURL);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('should open deep link if app is ready', () => {
            app.isReady.mockReturnValue(true);
            handleAppWillFinishLaunching();
            expect(openDeepLink).toHaveBeenCalledWith(testURL);
        });

        it('should wait until app is ready to open deep link', () => {
            let callback;
            app.once.mockImplementation((event, cb) => {
                if (event === 'ready') {
                    callback = cb;
                }
            });
            app.isReady.mockReturnValue(false);
            handleAppWillFinishLaunching();
            expect(openDeepLink).not.toHaveBeenCalled();
            callback({preventDefault: jest.fn()}, deepLinkURL);
            expect(openDeepLink).toHaveBeenCalledWith(testURL);
        });
    });

    describe('handleAppCertificateError', () => {
        const testURL = 'http://server-1.com';
        const callback = jest.fn();
        const event = {preventDefault: jest.fn()};
        const webContents = {loadURL: jest.fn()};
        const mainWindow = {};
        const promise = Promise.resolve({});
        const certificate = {};

        beforeEach(() => {
            WindowManager.getMainWindow.mockReturnValue(mainWindow);
        });

        afterEach(() => {
            jest.resetAllMocks();
            certificateErrorCallbacks.clear();
            dialog.showMessageBox.mockReturnValue(promise);
        });

        it('should not trust if explicitly untrusted by CertificateStore', () => {
            CertificateStore.isExplicitlyUntrusted.mockReturnValue(true);
            handleAppCertificateError(event, webContents, testURL, 'error-1', certificate, callback);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith(false);
        });

        it('should trust if trusted by CertificateStore', () => {
            CertificateStore.isExplicitlyUntrusted.mockReturnValue(false);
            CertificateStore.isTrusted.mockReturnValue(true);
            handleAppCertificateError(event, webContents, testURL, 'error-1', certificate, callback);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(callback).toHaveBeenCalledWith(true);
        });

        it('should not show additional dialogs if certificate error has already been logged', () => {
            certificateErrorCallbacks.set('http://server-1.com:error-1', callback);
            handleAppCertificateError(event, webContents, testURL, 'error-1', certificate, callback);
            expect(dialog.showMessageBox).not.toHaveBeenCalled();
        });

        it('should set callback if one is not already set', () => {
            handleAppCertificateError(event, webContents, testURL, 'error-1', certificate, callback);
            expect(certificateErrorCallbacks.has('http://server-1.com:error-1')).toBe(true);
        });

        it('should remove callback and not add certificate if user selects Cancel', async () => {
            dialog.showMessageBox.mockResolvedValue({response: 1});
            await handleAppCertificateError(event, webContents, testURL, 'error-1', certificate, callback);
            expect(callback).toHaveBeenCalledWith(false);
            expect(certificateErrorCallbacks.has('http://server-1.com:error-1')).toBe(false);
            expect(CertificateStore.add).not.toHaveBeenCalled();
        });

        it('should remove callback and add certificate if user selects More Details and Trust', async () => {
            dialog.showMessageBox.mockResolvedValue({response: 0});
            await handleAppCertificateError(event, webContents, testURL, 'error-1', certificate, callback);
            expect(callback).toHaveBeenCalledWith(true);
            expect(certificateErrorCallbacks.has('http://server-1.com:error-1')).toBe(false);
            expect(CertificateStore.add).toHaveBeenCalledWith('http://server-1.com', certificate);
            expect(CertificateStore.save).toHaveBeenCalled();
        });

        it('should explicitly untrust if user selects More Details and then cancel with the checkbox checked', async () => {
            dialog.showMessageBox.mockResolvedValueOnce({response: 0}).mockResolvedValueOnce({response: 1, checkboxChecked: true});
            await handleAppCertificateError(event, webContents, testURL, 'error-1', certificate, callback);
            expect(callback).toHaveBeenCalledWith(false);
            expect(certificateErrorCallbacks.has('http://server-1.com:error-1')).toBe(false);
            expect(CertificateStore.add).toHaveBeenCalledWith('http://server-1.com', certificate, true);
            expect(CertificateStore.save).toHaveBeenCalled();
        });
    });
});
