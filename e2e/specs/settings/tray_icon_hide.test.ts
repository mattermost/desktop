// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {openSettingsWindow} from '../../helpers/settingsWindow';

// ── MM-T1299: Do not show Mattermost icon in the menu bar ─────────────
// Disabling "Show icon in menu bar" via the real settings checkbox must tear
// down the tray icon. Triggering through the UI exercises the full
// renderer → IPC → Config → TrayIcon path a user takes; the native tray is
// invisible to Playwright, so the teardown is asserted by reading TrayIcon.tray
// through the E2E refs.
//
// Related: settings.test.ts MM-T4393_1 asserts the checkbox exists/persists.

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
        async ({electronApp}) => {
            const settingsWindow = await openSettingsWindow(electronApp);
            await settingsWindow.waitForSelector('#settingCategoryButton-general');
            await settingsWindow.click('#settingCategoryButton-general');
            await settingsWindow.waitForSelector('#CheckSetting_showTrayIcon');

            let testError: unknown;
            try {
                // Disable the tray icon through the real settings checkbox.
                await settingsWindow.click('#CheckSetting_showTrayIcon button');
                await settingsWindow.waitForSelector('.SettingsModal__saving :text("Changes saved")');

                // Native tray is invisible to Playwright — assert teardown via the ref.
                await expect.poll(
                    () => isTrayPresent(electronApp),
                    {timeout: 10_000, message: 'Tray icon must be torn down after disabling showTrayIcon'},
                ).toBe(false);
            } catch (error) {
                testError = error;
            } finally {
                // Re-enable and verify the tray actually came back — an unverified
                // restore here could leave a subsequent test observing a stale tray.
                try {
                    await settingsWindow.click('#CheckSetting_showTrayIcon button');
                    await expect.poll(
                        () => isTrayPresent(electronApp),
                        {timeout: 10_000, message: 'Tray icon must be restored after re-enabling showTrayIcon'},
                    ).toBe(true);
                } catch (restoreError) {
                    // eslint-disable-next-line no-console
                    console.error(
                        'MM-T1299: failed to restore the tray icon — subsequent tests may observe a stale tray.',
                        restoreError,
                    );
                    testError = testError ?? restoreError;
                }
            }
            if (testError) {
                throw testError;
            }
        },
    );
});
