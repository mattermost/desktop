// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {loginToMattermost} from '../../helpers/login';
import type {ServerView} from '../../helpers/serverView';
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

async function installDockBounceSpy(electronApp: ElectronApplication): Promise<void> {
    await electronApp.evaluate(({app}) => {
        (app as any).__e2eDockBounceCalls = [];
        const dock = app.dock;
        if (!dock) {
            return;
        }
        const originalBounce = dock.bounce.bind(dock);
        (dock as any).__e2eOriginalBounce = originalBounce;
        dock.bounce = ((type?: 'informational' | 'critical') => {
            (app as any).__e2eDockBounceCalls.push(type ?? 'informational');
            return originalBounce(type);
        }) as typeof dock.bounce;
    });
}

async function restoreDockBounce(electronApp: ElectronApplication): Promise<void> {
    await electronApp.evaluate(({app}) => {
        const dock = app.dock;
        if (dock && (dock as any).__e2eOriginalBounce) {
            dock.bounce = (dock as any).__e2eOriginalBounce;
            delete (dock as any).__e2eOriginalBounce;
        }
        delete (app as any).__e2eDockBounceCalls;
    });
}

type BounceConfigArgs = {bounceIcon: boolean; bounceIconType: 'informational' | 'critical' | null};

async function setBounceConfig(
    electronApp: ElectronApplication,
    bounceIcon: boolean,
    bounceIconType?: 'informational' | 'critical',
): Promise<void> {
    const args: BounceConfigArgs = {bounceIcon, bounceIconType: bounceIconType ?? null};
    await electronApp.evaluate((_, payload: BounceConfigArgs) => {
        const refs = (global as any).__e2eTestRefs;
        const Config = refs?.Config;
        if (!Config) {
            return;
        }
        const notifications = {...Config.notifications, bounceIcon: payload.bounceIcon};
        if (payload.bounceIconType) {
            notifications.bounceIconType = payload.bounceIconType;
        }
        Config.set('notifications', notifications);
    }, args);
}

async function setupServer(
    serverMap: Record<string, Array<{win: ServerView}>>,
): Promise<ServerView> {
    const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
    expect(firstServer, 'Server view must exist').toBeTruthy();
    await loginToMattermost(firstServer!);
    return firstServer!;
}

test.describe('notification_trigger/dock_bounce', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    // ── MM-T1295: Do not bounce the dock icon ──────────────────────────
    test('MM-T1295 Do not bounce the dock icon — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp, serverMap}) => {
            if (process.platform !== 'darwin') {
                test.skip(true, 'macOS only');
                return;
            }
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                const firstServer = await setupServer(serverMap);
                await setBounceConfig(electronApp, false);
                await installDockBounceSpy(electronApp);
                try {
                    await triggerTestNotification(firstServer);

                    const bounceCalls: string[] = await electronApp.evaluate(
                        ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                    );
                    expect(
                        bounceCalls,
                        'dock.bounce() must NOT be called when bounceIcon is false',
                    ).toHaveLength(0);
                } finally {
                    await restoreDockBounce(electronApp);
                }
            } finally {
                await releaseLock();
            }
        },
    );

    // ── MM-T1296: Bounce the dock icon (informational) ─────────────────
    test('MM-T1296 Bounce the dock icon — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp, serverMap}) => {
            if (process.platform !== 'darwin') {
                test.skip(true, 'macOS only');
                return;
            }
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                const firstServer = await setupServer(serverMap);
                await setBounceConfig(electronApp, true, 'informational');
                await installDockBounceSpy(electronApp);
                try {
                    await triggerTestNotification(firstServer);

                    await expect.poll(
                        () => electronApp.evaluate(
                            ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                        ),
                        {timeout: 10_000, message: 'dock.bounce("informational") must be called'},
                    ).toContain('informational');
                } finally {
                    await restoreDockBounce(electronApp);
                }
            } finally {
                await releaseLock();
            }
        },
    );

    // ── MM-T1297: Bounce the dock until I open the app (critical) ──────
    test('MM-T1297 Bounce the dock until I open the app — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp, serverMap}) => {
            if (process.platform !== 'darwin') {
                test.skip(true, 'macOS only');
                return;
            }
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                const firstServer = await setupServer(serverMap);
                await setBounceConfig(electronApp, true, 'critical');
                await installDockBounceSpy(electronApp);
                try {
                    await triggerTestNotification(firstServer);

                    await expect.poll(
                        () => electronApp.evaluate(
                            ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                        ),
                        {timeout: 10_000, message: 'dock.bounce("critical") must be called'},
                    ).toContain('critical');
                } finally {
                    await restoreDockBounce(electronApp);
                }
            } finally {
                await releaseLock();
            }
        },
    );
});
