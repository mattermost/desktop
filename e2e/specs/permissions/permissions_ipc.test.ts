// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

const SHOW_SETTINGS_WINDOW = 'show-settings-window';
type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

async function openSettingsWindow(electronApp: ElectronApplication) {
    const existingWindow = electronApp.windows().find((window) => window.url().includes('settings'));
    if (existingWindow) {
        await existingWindow.waitForLoadState().catch(() => {});
        return existingWindow;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            await electronApp.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('Execution context was destroyed') || attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    const settingsWindow = electronApp.windows().find((window) => window.url().includes('settings')) ??
        await electronApp.waitForEvent('window', {
            predicate: (window) => window.url().includes('settings'),
            timeout: 15_000,
        });

    await settingsWindow.waitForLoadState().catch(() => {});
    return settingsWindow;
}

test.describe('permissions/ipc', () => {
    test('E2E-P01: should return a valid media access status via GET_MEDIA_ACCESS_STATUS IPC', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        if (process.platform === 'linux') {
            test.skip(true, 'systemPreferences.getMediaAccessStatus is not available on Linux');
            return;
        }

        const settingsWindow = await openSettingsWindow(electronApp);

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

        const settingsWindow = await openSettingsWindow(electronApp);

        await electronApp.evaluate(({shell}) => {
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

        const settingsWindow = await openSettingsWindow(electronApp);

        await electronApp.evaluate(({shell}) => {
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
