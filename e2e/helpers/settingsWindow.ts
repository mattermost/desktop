// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

import {SHOW_SETTINGS_WINDOW} from './ipcChannels';
import {evaluateInMainProcessWithArg} from './testRefs';

function findSettingsPage(app: ElectronApplication): Page | undefined {
    return app.windows().find((window) => {
        try {
            return window.url().includes('settings');
        } catch {
            return false;
        }
    });
}

async function waitForSettingsPage(app: ElectronApplication, timeoutMs = 15_000): Promise<Page> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const settingsWindow = findSettingsPage(app);
        if (settingsWindow) {
            await settingsWindow.waitForLoadState().catch(() => {});
            return settingsWindow;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Settings window did not open');
}

export async function openSettingsWindow(electronApp: ElectronApplication): Promise<Page> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const existingWindow = findSettingsPage(electronApp);
        if (existingWindow) {
            try {
                await existingWindow.waitForLoadState();
                return existingWindow;
            } catch (error) {
                if (attempt === 4) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 250));
                continue;
            }
        }

        await evaluateInMainProcessWithArg(electronApp, ({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);

        try {
            return await waitForSettingsPage(electronApp);
        } catch (error) {
            if (attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw new Error('Settings window did not open');
}

export async function waitForSettingsModal(
    app: ElectronApplication,
    options?: {timeout?: number},
): Promise<Page> {
    return waitForSettingsPage(app, options?.timeout ?? 15_000);
}
