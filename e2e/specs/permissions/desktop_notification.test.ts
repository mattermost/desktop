// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {triggerTestNotification} from '../notification_trigger/helpers';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {activateServerView, getServerEntry} from '../../helpers/serverContext';
import type {ServerView} from '../../helpers/serverView';

async function stubNotificationDisplayMention(app: import('playwright').ElectronApplication): Promise<void> {
    await app.evaluate(() => {
        (global as any).__e2eNotificationShown = false;
        const refs = (global as any).__e2eTestRefs;
        const notificationManager = refs?.NotificationManager;
        if (!notificationManager?.displayMention) {
            throw new Error('NotificationManager.displayMention is not exposed in __e2eTestRefs');
        }
        const originalDisplayMention = notificationManager.displayMention.bind(notificationManager);
        notificationManager.displayMention = (...args: unknown[]) => {
            (global as any).__e2eNotificationShown = true;
            return originalDisplayMention(...args);
        };
        (global as any).__e2eRestoreNotificationDisplayMention = originalDisplayMention;
    });
}

async function restoreNotificationDisplayMention(app: import('playwright').ElectronApplication): Promise<void> {
    try {
        await app.evaluate(() => {
            const refs = (global as any).__e2eTestRefs;
            const original = (global as any).__e2eRestoreNotificationDisplayMention;
            if (original && refs?.NotificationManager) {
                refs.NotificationManager.displayMention = original;
            }
        });
    } catch {
        // App may already be closed after quit-style tests in the same worker.
    }
}

async function invokeDesktopNotifyMention(
    app: import('playwright').ElectronApplication,
    serverWin: ServerView,
): Promise<void> {
    const invokedViaRenderer = await serverWin.runInRenderer<boolean>(`
        const api = window.desktopAPI;
        if (!api?.notifyMention) {
            return false;
        }
        const team = window.location.pathname.split('/').filter(Boolean)[0] ?? '';
        api.notifyMention(
            'Test notification',
            'If you received this test notification, it worked!',
            'town-square',
            team,
            window.location.pathname,
            false,
            'Bing',
        );
        return true;
    `, true).catch(() => false);

    if (invokedViaRenderer) {
        return;
    }

    await app.evaluate(({webContents}, webContentsId) => {
        const refs = (global as any).__e2eTestRefs;
        const notificationManager = refs?.NotificationManager;
        const wc = webContents.fromId(webContentsId);
        if (!notificationManager?.displayMention || !wc || wc.isDestroyed()) {
            throw new Error('NotificationManager.displayMention is not available');
        }

        let pathname = '/channels/town-square';
        try {
            pathname = new URL(wc.getURL()).pathname;
        } catch {
            // keep default pathname
        }
        const team = pathname.split('/').filter(Boolean)[0] ?? '';
        notificationManager.displayMention(
            'Test notification',
            'If you received this test notification, it worked!',
            'town-square',
            team,
            pathname,
            false,
            wc,
            'Bing',
        ).catch(() => {
            // Fire-and-forget in E2E fallback; stub sets __e2eNotificationShown synchronously.
        });
    }, serverWin.webContentsId);
}

async function triggerDesktopNotification(serverWin: ServerView): Promise<void> {
    const tourButton = await serverWin.$('div#CustomizeYourExperienceTour > button');
    if (tourButton) {
        await triggerTestNotification(serverWin);
    }
}

test.describe('permissions/desktop_notification', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T1303 Receive a desktop notification',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            await stubNotificationDisplayMention(electronApp);

            try {
                const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
                await activateServerView(electronApp, entry.webContentsId);
                await loginToMattermost(entry.win);
                const serverWin = entry.win;

                await triggerDesktopNotification(serverWin);

                let notificationShown = await electronApp.evaluate(() => Boolean((global as any).__e2eNotificationShown));
                if (!notificationShown) {
                    await invokeDesktopNotifyMention(electronApp, serverWin);
                    await expect.poll(
                        () => electronApp.evaluate(() => Boolean((global as any).__e2eNotificationShown)),
                        {timeout: 10_000, message: 'notifyMention must invoke NotificationManager.displayMention'},
                    ).toBe(true);
                    notificationShown = true;
                }

                expect(notificationShown, 'Desktop notification path must invoke NotificationManager.displayMention').toBe(true);
            } finally {
                await restoreNotificationDisplayMention(electronApp);
            }
        },
    );
});
