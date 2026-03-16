// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SHOW_SETTINGS_WINDOW} from 'src/common/communication';

import {test, expect} from '../../fixtures/index';

test.describe('permissions/ipc', () => {
    test('E2E-P01: should return a valid media access status via GET_MEDIA_ACCESS_STATUS IPC', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        await electronApp.evaluate(({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);
        const settingsWindow = await electronApp.waitForEvent('window', {
            predicate: (w) => w.url().includes('settings'),
        });
        await settingsWindow.waitForLoadState('domcontentloaded');

        const status = await settingsWindow.evaluate(
            () => (window as any).desktop.getMediaAccessStatus('microphone'),
        );
        expect(['granted', 'denied', 'not-determined', 'restricted', 'unknown']).toContain(status);
    });

    test('E2E-P02: should open ms-settings:privacy-webcam for camera preferences (Windows only)', {tag: ['@P2', '@all', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }

        await electronApp.evaluate(({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);
        const settingsWindow = await electronApp.waitForEvent('window', {
            predicate: (w) => w.url().includes('settings'),
        });
        await settingsWindow.waitForLoadState('domcontentloaded');

        await electronApp.evaluate(() => {
            const {shell} = require('electron');
            (global as any).__testCapturedExternalURL = null;
            shell.openExternal = (url: string) => {
                (global as any).__testCapturedExternalURL = url;
                return Promise.resolve();
            };
        });

        await settingsWindow.evaluate(
            () => (window as any).desktop.openWindowsCameraPreferences(),
        );

        const capturedURL = await electronApp.evaluate(
            () => (global as any).__testCapturedExternalURL,
        );
        expect(capturedURL).toBe('ms-settings:privacy-webcam');
    });

    test('E2E-P03: should open ms-settings:privacy-microphone for microphone preferences (Windows only)', {tag: ['@P2', '@all', '@win32']}, async ({electronApp}) => {
        if (process.platform !== 'win32') {
            test.skip(true, 'Windows only');
            return;
        }

        await electronApp.evaluate(({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);
        const settingsWindow = await electronApp.waitForEvent('window', {
            predicate: (w) => w.url().includes('settings'),
        });
        await settingsWindow.waitForLoadState('domcontentloaded');

        await electronApp.evaluate(() => {
            const {shell} = require('electron');
            (global as any).__testCapturedExternalURL = null;
            shell.openExternal = (url: string) => {
                (global as any).__testCapturedExternalURL = url;
                return Promise.resolve();
            };
        });

        await settingsWindow.evaluate(
            () => (window as any).desktop.openWindowsMicrophonePreferences(),
        );

        const capturedURL = await electronApp.evaluate(
            () => (global as any).__testCapturedExternalURL,
        );
        expect(capturedURL).toBe('ms-settings:privacy-microphone');
    });
});
