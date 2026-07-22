// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {demoConfig} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {installDockBounceSpy, restoreDockBounceSpy} from '../../helpers/methodSpy';
import {triggerNotificationEffects} from '../../helpers/notificationEffects';

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

test.describe('notification_trigger/dock_bounce', () => {
    test.use({appConfig: demoConfig});
    test.setTimeout(120_000);

    test('MM-T1295 Do not bounce the dock icon — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                await setBounceConfig(electronApp, false);
                await installDockBounceSpy(electronApp);
                try {
                    await triggerNotificationEffects(electronApp, true);

                    const bounceCalls: string[] = await electronApp.evaluate(
                        ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                    );
                    expect(
                        bounceCalls,
                        'dock.bounce() must NOT be called when bounceIcon is false',
                    ).toHaveLength(0);
                } finally {
                    await restoreDockBounceSpy(electronApp);
                }
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T1296 Bounce the dock icon — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                await setBounceConfig(electronApp, true, 'informational');
                await installDockBounceSpy(electronApp);
                try {
                    await triggerNotificationEffects(electronApp, true);

                    await expect.poll(
                        () => electronApp.evaluate(
                            ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                        ),
                        {timeout: 10_000, message: 'dock.bounce("informational") must be called'},
                    ).toContain('informational');
                } finally {
                    await restoreDockBounceSpy(electronApp);
                }
            } finally {
                await releaseLock();
            }
        },
    );

    test('MM-T1297 Bounce the dock until I open the app — macOS ONLY',
        {tag: ['@P2', '@darwin']},
        async ({electronApp}) => {
            await waitForAppReady(electronApp);

            const releaseLock = await acquireExclusiveLock('dock-bounce-state');
            try {
                await setBounceConfig(electronApp, true, 'critical');
                await installDockBounceSpy(electronApp);
                try {
                    await triggerNotificationEffects(electronApp, true);

                    await expect.poll(
                        () => electronApp.evaluate(
                            ({app}) => (app as any).__e2eDockBounceCalls ?? [],
                        ),
                        {timeout: 10_000, message: 'dock.bounce("critical") must be called'},
                    ).toContain('critical');
                } finally {
                    await restoreDockBounceSpy(electronApp);
                }
            } finally {
                await releaseLock();
            }
        },
    );
});
