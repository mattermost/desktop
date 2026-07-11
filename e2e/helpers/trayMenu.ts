// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {waitForSettingsModal} from './settingsWindow';
import {clickTrayMenuItem} from './tray';

export function traySettingsMenuLabel(): string {
    return process.platform === 'darwin' ? 'Preferences...' : 'Settings';
}

export async function openSettingsFromTray(app: ElectronApplication) {
    const existingSettings = await waitForSettingsModal(app, {timeout: 1_000}).catch(() => null);
    if (existingSettings) {
        return existingSettings;
    }

    try {
        await clickTrayMenuItem(app, 'tray:settings');
    } catch {
        let labels: string[];
        if (process.platform === 'darwin') {
            labels = ['Preferences...', 'Preferences', 'tray:settings'];
        } else {
            labels = ['Settings...', 'Settings', '&Settings', 'tray:settings'];
        }
        let clicked = false;
        for (const label of labels) {
            try {
                await clickTrayMenuItem(app, label);
                clicked = true;
                break;
            } catch {
                // try next label variant
            }
        }
        if (!clicked) {
            await clickTrayMenuItem(app, traySettingsMenuLabel());
        }
    }

    return waitForSettingsModal(app);
}

export async function clickTrayQuit(app: ElectronApplication): Promise<void> {
    try {
        await clickTrayMenuItem(app, 'role:quit');
        return;
    } catch {
        // Fall back to localized quit labels below.
    }

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
