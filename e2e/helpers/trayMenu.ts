// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {clickTrayMenuItem} from './tray';

export function traySettingsMenuLabel(): string {
    return process.platform === 'darwin' ? 'Preferences...' : 'Settings';
}

export async function openSettingsFromTray(app: ElectronApplication) {
    const existingSettings = app.windows().find((window) => window.url().includes('settings'));
    if (existingSettings) {
        await existingSettings.waitForLoadState();
        return existingSettings;
    }

    const windowPromise = app.waitForEvent('window', {
        predicate: (window) => window.url().includes('settings'),
        timeout: 15_000,
    });
    await clickTrayMenuItem(app, traySettingsMenuLabel());
    const settingsWindow = await windowPromise;
    await settingsWindow.waitForLoadState();
    return settingsWindow;
}

export async function clickTrayQuit(app: ElectronApplication): Promise<void> {
    let quitLabels: string[];
    if (process.platform === 'win32') {
        quitLabels = ['Exit', 'Quit'];
    } else if (process.platform === 'darwin') {
        quitLabels = ['Quit Mattermost', 'Quit Electron', 'Quit'];
    } else {
        quitLabels = ['Quit Mattermost', 'Quit'];
    }

    for (const label of quitLabels) {
        try {
            await clickTrayMenuItem(app, label);
            return;
        } catch {
            // try next localized label
        }
    }

    throw new Error(`Tray quit menu item not found (tried: ${quitLabels.join(', ')})`);
}
