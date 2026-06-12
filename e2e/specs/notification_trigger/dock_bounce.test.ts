// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';
import {triggerTestNotification} from './helpers';

// ── Production code path ───────────────────────────────────────────────
// src/main/notifications/index.ts :: flashFrame()
//   if (process.platform === 'darwin' && Config.notifications.bounceIcon
//       && Config.notifications.bounceIconType) {
//     app.dock?.bounce(Config.notifications.bounceIconType);
//   }
//
// The dock bounce is driven by Config.notifications.bounceIcon (boolean)
// and Config.notifications.bounceIconType ('informational' | 'critical').
// We set these via the app config, trigger a real notification, and spy on
// app.dock.bounce() to verify it was called with the correct type.

test.describe('notification_trigger/dock_bounce', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    // ── MM-T1295: Do not bounce the dock icon ──────────────────────────
    test('MM-T1295 Do not bounce the dock icon — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
                expect(firstServer, 'Server view must exist').toBeTruthy();
                await loginToMattermost(firstServer!);

                // Disable dock bounce in config
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    if (Config) {
                        Config.set('notifications.bounceIcon', false);
                    }
                });

                // Spy on app.dock.bounce
                await electronApp.evaluate(({app}) => {
                    (app as any).__e2eDockBounceCalls = [];
                    const dock = app.dock;
                    if (dock) {
                        const originalBounce = dock.bounce.bind(dock);
                        (dock as any).__e2eOriginalBounce = originalBounce;
                        dock.bounce = (type?: string) => {
                            (app as any).__e2eDockBounceCalls.push(type ?? 'informational');
                            return originalBounce(type);
                        };
                    }
                });

                // Trigger a real notification
                await triggerTestNotification(firstServer!);

                // Dock bounce must NOT have been called
                const bounceCalls: string[] = await electronApp.evaluate(
                    ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                );
                expect(
                    bounceCalls,
                    'dock.bounce() must NOT be called when bounceIcon is false',
                ).toHaveLength(0);

                // Restore dock.bounce
                await electronApp.evaluate(({app}) => {
                    const dock = app.dock;
                    if (dock && (dock as any).__e2eOriginalBounce) {
                        dock.bounce = (dock as any).__e2eOriginalBounce;
                    }
                    delete (app as any).__e2eDockBounceCalls;
                    delete (dock as any).__e2eOriginalBounce;
                });
            } finally {
                await releaseLock();
            }
        },
    );

    // ── MM-T1296: Bounce the dock icon (informational) ─────────────────
    test('MM-T1296 Bounce the dock icon — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
                expect(firstServer, 'Server view must exist').toBeTruthy();
                await loginToMattermost(firstServer!);

                // Enable informational dock bounce
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    if (Config) {
                        Config.set('notifications.bounceIcon', true);
                        Config.set('notifications.bounceIconType', 'informational');
                    }
                });

                // Spy on app.dock.bounce
                await electronApp.evaluate(({app}) => {
                    (app as any).__e2eDockBounceCalls = [];
                    const dock = app.dock;
                    if (dock) {
                        const originalBounce = dock.bounce.bind(dock);
                        (dock as any).__e2eOriginalBounce = originalBounce;
                        dock.bounce = (type?: string) => {
                            (app as any).__e2eDockBounceCalls.push(type ?? 'informational');
                            return originalBounce(type);
                        };
                    }
                });

                // Trigger a real notification
                await triggerTestNotification(firstServer!);

                // Dock bounce must have been called with 'informational'
                await expect.poll(
                    () => electronApp.evaluate(
                        ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                    ),
                    {timeout: 10_000, message: 'dock.bounce("informational") must be called'},
                ).toContain('informational');

                // Restore
                await electronApp.evaluate(({app}) => {
                    const dock = app.dock;
                    if (dock && (dock as any).__e2eOriginalBounce) {
                        dock.bounce = (dock as any).__e2eOriginalBounce;
                    }
                    delete (app as any).__e2eDockBounceCalls;
                    delete (dock as any).__e2eOriginalBounce;
                });
            } finally {
                await releaseLock();
            }
        },
    );

    // ── MM-T1297: Bounce the dock until I open the app (critical) ──────
    test('MM-T1297 Bounce the dock until I open the app — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
                expect(firstServer, 'Server view must exist').toBeTruthy();
                await loginToMattermost(firstServer!);

                // Enable critical dock bounce
                await electronApp.evaluate(() => {
                    const refs = (global as any).__e2eTestRefs;
                    const Config = refs?.Config;
                    if (Config) {
                        Config.set('notifications.bounceIcon', true);
                        Config.set('notifications.bounceIconType', 'critical');
                    }
                });

                // Spy on app.dock.bounce
                await electronApp.evaluate(({app}) => {
                    (app as any).__e2eDockBounceCalls = [];
                    const dock = app.dock;
                    if (dock) {
                        const originalBounce = dock.bounce.bind(dock);
                        (dock as any).__e2eOriginalBounce = originalBounce;
                        dock.bounce = (type?: string) => {
                            (app as any).__e2eDockBounceCalls.push(type ?? 'informational');
                            return originalBounce(type);
                        };
                    }
                });

                // Trigger a real notification
                await triggerTestNotification(firstServer!);

                // Dock bounce must have been called with 'critical'
                await expect.poll(
                    () => electronApp.evaluate(
                        ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                    ),
                    {timeout: 10_000, message: 'dock.bounce("critical") must be called'},
                ).toContain('critical');

                // Restore
                await electronApp.evaluate(({app}) => {
                    const dock = app.dock;
                    if (dock && (dock as any).__e2eOriginalBounce) {
                        dock.bounce = (dock as any).__e2eOriginalBounce;
                    }
                    delete (app as any).__e2eDockBounceCalls;
                    delete (dock as any).__e2eOriginalBounce;
                });
            } finally {
                await releaseLock();
            }
        },
    );
});
