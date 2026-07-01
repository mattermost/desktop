// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';

import {SHOW_SETTINGS_WINDOW} from '../../src/common/communication';
import {evaluateInMainProcessWithArg} from './testRefs';

export async function openSettingsWindow(electronApp: ElectronApplication): Promise<Page> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const existingWindow = electronApp.windows().find((window) => window.url().includes('settings'));
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

        // Route through evaluateInMainProcessWithArg to reuse its transient
        // "Execution context was destroyed" retry behavior instead of
        // duplicating the try/catch loop here.
        await evaluateInMainProcessWithArg(electronApp, ({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);

        try {
            const settingsWindow = electronApp.windows().find((window) => window.url().includes('settings')) ??
                await electronApp.waitForEvent('window', {
                    predicate: (window) => window.url().includes('settings'),
                    timeout: 3_000,
                });

            await settingsWindow.waitForLoadState();
            return settingsWindow;
        } catch (error) {
            if (attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw new Error('Settings window did not open');
}
