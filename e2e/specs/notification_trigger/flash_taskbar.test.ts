// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {demoConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {triggerFlashEffects} from '../../helpers/notificationEffects';

// ── MM-T1293: Flash taskbar icon — Windows & Linux ONLY ──────────────
// Production path: src/main/notifications/index.ts :: flashFrame()
//   if (process.platform === 'linux' || process.platform === 'win32') {
//     if (Config.notifications.flashWindow) {
//       MainWindow.get()?.flashFrame(flash);
//     }
//   }
//
// We enable flashWindow in config, invoke the production flashFrame() helper
// (same code path notification `show` handlers use), and spy on
// BrowserWindow.flashFrame() to verify it was called.

test.describe('notification_trigger/flash_taskbar', () => {
    test.use({appConfig: demoConfig});
    test.setTimeout(120_000);

    test('MM-T1293 Flash taskbar icon — Windows & Linux ONLY',
        {tag: ['@P2', '@win32', '@linux']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            const releaseLock = await acquireExclusiveLock('flash-taskbar-state');
            try {
                // Enable flashWindow in config (schema allows 0 or 2 only)
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    if (Config) {
                        Config.set('notifications', {...Config.notifications, flashWindow: 2});
                    }
                });

                await electronApp.evaluate(() => {
                    (global as any).__e2eFlashFrameCalls = [];
                    const refs = (global as any).__e2eTestRefs;
                    const mainWin = refs?.MainWindow?.get?.();
                    if (!mainWin) {
                        throw new Error('Main window not available for flashFrame spy');
                    }
                    const originalFlashFrame = mainWin.flashFrame.bind(mainWin);
                    (mainWin as any).__e2eOriginalFlashFrame = originalFlashFrame;
                    mainWin.flashFrame = (flash: boolean) => {
                        (global as any).__e2eFlashFrameCalls.push(flash);
                        originalFlashFrame(flash);
                    };
                });

                try {
                    await triggerFlashEffects(electronApp, true);

                    await expect.poll(
                        () => electronApp.evaluate(() => (global as any).__e2eFlashFrameCalls ?? []),
                        {timeout: 10_000, message: 'flashFrame(true) must be called when flashWindow is enabled'},
                    ).toContain(true);
                } finally {
                    await electronApp.evaluate(() => {
                        const refs = (global as any).__e2eTestRefs;
                        const mainWin = refs?.MainWindow?.get?.();
                        if (mainWin && (mainWin as any).__e2eOriginalFlashFrame) {
                            mainWin.flashFrame = (mainWin as any).__e2eOriginalFlashFrame;
                        }
                        delete (global as any).__e2eFlashFrameCalls;
                    });
                }
            } finally {
                await releaseLock();
            }
        },
    );
});
