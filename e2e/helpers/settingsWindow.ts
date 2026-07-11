// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {lookupModalByUrl, waitForModalView} from './modalPage';
import type {ServerView} from './serverView';
import {SHOW_SETTINGS_WINDOW} from './ipcChannels';
import {evaluateInMainProcessWithArg} from './testRefs';

const SETTINGS_URL_FRAGMENT = 'settings';

export async function openSettingsWindow(electronApp: ElectronApplication): Promise<ServerView> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const existingModal = await lookupModalByUrl(electronApp, {urlIncludes: SETTINGS_URL_FRAGMENT});
        if (existingModal) {
            return waitForModalView(electronApp, {urlIncludes: SETTINGS_URL_FRAGMENT});
        }

        await evaluateInMainProcessWithArg(electronApp, ({ipcMain}, showWindow) => {
            ipcMain.emit(showWindow);
        }, SHOW_SETTINGS_WINDOW);

        try {
            return await waitForModalView(electronApp, {urlIncludes: SETTINGS_URL_FRAGMENT});
        } catch (error) {
            if (attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw new Error('Settings modal did not open');
}

export async function waitForSettingsModal(
    app: ElectronApplication,
    options?: {timeout?: number},
): Promise<ServerView> {
    return waitForModalView(app, {urlIncludes: SETTINGS_URL_FRAGMENT, timeout: options?.timeout});
}
