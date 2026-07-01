// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';

// ── MM-T1299: Do not show Mattermost icon in the menu bar ─────────────
// Tests that disabling the tray icon setting actually hides the tray icon.
// The production path: Config.showTrayIcon controls whether the TrayIcon
// module creates a tray icon. When false, no tray should exist.
//
// Related: settings.test.ts MM-T4393_1 tests the checkbox exists;
// this test verifies the behavioural effect of toggling it off.

test.describe('settings/tray_icon_hide', () => {
    test('MM-T1299 Do not show Mattermost icon in the menu bar',
        {tag: ['@P2', '@darwin', '@linux']},
        async ({electronApp}) => {
            // Verify the tray icon setting can be read from config
            const trayIconConfigAccessible = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const Config = refs?.Config;
                if (!Config) {
                    return false;
                }
                return typeof Config.showTrayIcon === 'boolean';
            });
            expect(trayIconConfigAccessible, 'showTrayIcon config must be accessible').toBe(true);

            const initialShowTrayIcon = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                return refs?.Config?.showTrayIcon ?? true;
            });

            try {
                // Disable tray icon
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    refs?.Config?.set('showTrayIcon', false);
                });

                // Verify the config was updated
                const trayIconDisabled = await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    return Config ? Config.showTrayIcon === false : false;
                });
                expect(trayIconDisabled, 'showTrayIcon must be false after disabling').toBe(true);

                // Tray teardown is async — poll until TrayIcon.tray is gone.
                await expect.poll(
                    () => electronApp.evaluate(() => {
                        const refs = (global as any).__e2eTestRefs;
                        const TrayIcon = refs?.TrayIcon;
                        return TrayIcon ? TrayIcon.tray === null || TrayIcon.tray === undefined : false;
                    }),
                    {timeout: 10_000, message: 'Tray icon must be torn down after showTrayIcon=false'},
                ).toBe(true);
            } finally {
                await electronApp.evaluate((savedShowTrayIcon) => {
                    const refs = (global as any).__e2eTestRefs;
                    refs?.Config?.set('showTrayIcon', savedShowTrayIcon);
                }, initialShowTrayIcon);
            }
        },
    );
});
