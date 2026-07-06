// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';

import {clickTrayMenuItem} from './tray';

async function findSettingsPage(app: ElectronApplication): Promise<Page | null> {
    return app.windows().find((window) => {
        try {
            return window.url().includes('settings');
        } catch {
            return false;
        }
    }) ?? null;
}

async function waitForSettingsPage(app: ElectronApplication): Promise<Page> {
    let settingsWindow: Page | null = null;
    await expect.poll(async () => {
        settingsWindow = await findSettingsPage(app);
        return settingsWindow;
    }, {timeout: 15_000, message: 'Settings page must open after tray menu click'}).not.toBeNull();
    await settingsWindow!.waitForLoadState();
    return settingsWindow!;
}

export function traySettingsMenuLabel(): string {
    return process.platform === 'darwin' ? 'Preferences...' : 'Settings';
}

export async function openSettingsFromTray(app: ElectronApplication): Promise<Page> {
    const existingSettings = await findSettingsPage(app);
    if (existingSettings) {
        await existingSettings.waitForLoadState();
        return existingSettings;
    }

    // Semantic click avoids i18n / mnemonic label mismatches ("Settings" vs "Settings...").
    try {
        await clickTrayMenuItem(app, 'tray:settings');
    } catch {
        const labels = process.platform === 'darwin' ?
            ['Preferences...', 'Preferences', 'tray:settings'] :
            ['Settings...', 'Settings', '&Settings', 'tray:settings'];
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

    return waitForSettingsPage(app);
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
