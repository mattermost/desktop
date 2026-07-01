// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {closeElectronAppFast} from '../../helpers/electronApp';
import {openSettingsWindow} from '../../helpers/settingsWindow';

// ── MM-T1299: Do not show Mattermost icon in the menu bar ─────────────
// showTrayIcon is only read once, at boot (src/main/app/initialize.ts,
// gated by shouldShowTrayIcon()) — toggling it in Settings while the app is
// running does NOT create or destroy the live tray icon; TrayIcon.destroy()
// is even a no-op on macOS/Linux (src/app/system/tray/tray.ts). The setting
// only takes effect on the next launch, so this test toggles it via the real
// settings checkbox, relaunches against the same userDataDir, and asserts
// the tray on the NEW instance — the behavior that's actually implemented.
//
// Related: settings.test.ts MM-T4393_2 already covers the config-file write;
// this test covers the resulting tray behavior on next launch.

/** Read whether a live (non-destroyed) tray icon currently exists. */
async function isTrayPresent(electronApp: ElectronApplication): Promise<boolean> {
    return electronApp.evaluate(() => {
        const refs = (global as any).__e2eTestRefs;
        if (!refs) {
            return false;
        }
        const tray = refs.TrayIcon.tray;
        return Boolean(tray) && !(tray.isDestroyed?.() ?? false);
    });
}

test.describe('settings/tray_icon_hide', () => {
    test('MM-T1299 Do not show Mattermost icon in the menu bar',
        {tag: ['@P2', '@darwin', '@linux']},
        async ({}, testInfo) => {
            const userDataDir = path.join(testInfo.outputDir, 'tray-icon-hide-userdata');
            fs.mkdirSync(userDataDir, {recursive: true});
            const config = {...demoConfig, showTrayIcon: true};

            const app1 = await launchDirectTestApp(userDataDir, config);
            try {
                await expect.poll(
                    () => isTrayPresent(app1),
                    {timeout: 10_000, message: 'Tray icon must be present at boot when showTrayIcon is true'},
                ).toBe(true);

                const settingsWindow = await openSettingsWindow(app1);
                await settingsWindow.waitForSelector('#settingCategoryButton-general');
                await settingsWindow.click('#settingCategoryButton-general');
                await settingsWindow.waitForSelector('#CheckSetting_showTrayIcon');
                await settingsWindow.click('#CheckSetting_showTrayIcon button');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                const configFilePath = path.join(userDataDir, 'config.json');
                const updatedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as {showTrayIcon: boolean};
                expect(updatedConfig.showTrayIcon, 'showTrayIcon must be false in config.json after disabling').toBe(false);
            } finally {
                await closeElectronAppFast(app1, userDataDir);
            }

            // The disabled setting only takes effect on the next launch — the config
            // file on disk already has showTrayIcon: false, so don't overwrite it.
            const app2 = await launchDirectTestApp(userDataDir, config, {writeConfig: false});
            try {
                await expect.poll(
                    () => isTrayPresent(app2),
                    {timeout: 10_000, message: 'Tray icon must not be created at boot when showTrayIcon is false'},
                ).toBe(false);
            } finally {
                await closeElectronAppFast(app2, userDataDir);
            }
        },
    );
});
