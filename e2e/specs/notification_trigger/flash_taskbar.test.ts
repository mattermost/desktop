// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';
import {triggerTestNotification} from '../notification_trigger/helpers';

// ── MM-T1293: Flash taskbar icon — Windows & Linux ONLY ──────────────
// Production path: src/main/notifications/index.ts :: flashFrame()
//   if (process.platform === 'linux' || process.platform === 'win32') {
//     if (Config.notifications.flashWindow) {
//       MainWindow.get()?.flashFrame(flash);
//     }
//   }
//
// We enable flashWindow in config, trigger a real notification, and spy
// on BrowserWindow.flashFrame() to verify it was called.

test.describe('notification_trigger/flash_taskbar', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T1293 Flash taskbar icon — Windows & Linux ONLY',
        {tag: ['@P2', '@win32', '@linux']},
        async ({electronApp, serverMap}) => {
            if (process.platform === 'darwin') {
                test.skip(true, 'Flash taskbar is Windows/Linux only');
                return;
            }
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('flash-taskbar-state');
            try {
                const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
                expect(firstServer, 'Server view must exist').toBeTruthy();
                await loginToMattermost(firstServer!);

                // Enable flashWindow in config
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    if (Config) {
                        Config.set('notifications.flashWindow', 1); // 1 = flash until focused
                    }
                });

                // Spy on BrowserWindow.flashFrame
                await electronApp.evaluate(({BrowserWindow}) => {
                    (BrowserWindow as any).__e2eFlashFrameCalls = [];
                    const mainWin = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                    if (mainWin) {
                        const originalFlashFrame = mainWin.flashFrame.bind(mainWin);
                        (mainWin as any).__e2eOriginalFlashFrame = originalFlashFrame;
                        mainWin.flashFrame = (flash: boolean) => {
                            (BrowserWindow as any).__e2eFlashFrameCalls.push(flash);
                            originalFlashFrame(flash);
                        };
                    }
                });

                // Trigger a real notification
                await triggerTestNotification(firstServer!);

                // flashFrame(true) must have been called
                await expect.poll(
                    () => electronApp.evaluate(
                        ({BrowserWindow}) => (BrowserWindow as any).__e2eFlashFrameCalls ?? [],
                    ),
                    {timeout: 10_000, message: 'flashFrame(true) must be called after notification'},
                ).toContain(true);

                // Restore flashFrame
                await electronApp.evaluate(({BrowserWindow}) => {
                    const mainWin = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
                    if (mainWin && (mainWin as any).__e2eOriginalFlashFrame) {
                        mainWin.flashFrame = (mainWin as any).__e2eOriginalFlashFrame;
                    }
                    delete (BrowserWindow as any).__e2eFlashFrameCalls;
                });
            } finally {
                await releaseLock();
            }
        },
    );
});
