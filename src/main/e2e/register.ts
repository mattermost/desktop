// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {app} from 'electron';

import {Logger} from 'common/log';
import {setTestField} from 'common/utils/util';

import {createClickTrayMenuItemHandler} from './trayMenu';

const log = new Logger('E2E.Register');

type E2ETestRefs = {
    updateNotifier?: unknown;
    NotificationManager?: unknown;
};

type E2ETestGlobal = typeof globalThis & {
    __e2eTestRefs?: E2ETestRefs;
};

/**
 * Extends __e2eTestRefs and tray-menu automation hooks used by Playwright E2E tests.
 * Loaded via side-effect import from updateNotifier (test builds only).
 */
export async function registerExtendedE2eHooks(): Promise<void> {
    const refs = (global as E2ETestGlobal).__e2eTestRefs;
    if (!refs) {
        return;
    }

    const [{default: updateNotifierModule}, {default: notificationManagerModule}] = await Promise.all([
        import('main/updateNotifier'),
        import('main/notifications'),
    ]);
    refs.updateNotifier = updateNotifierModule;
    refs.NotificationManager = notificationManagerModule;

    setTestField('__e2eClickTrayMenuItem', createClickTrayMenuItemHandler());
}

async function waitForE2eTestRefs(timeoutMs = 30_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if ((global as E2ETestGlobal).__e2eTestRefs) {
            return true;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
}

if (process.env.NODE_ENV === 'test') {
    app.whenReady().then(async () => {
        const refsReady = await waitForE2eTestRefs();
        if (refsReady) {
            await registerExtendedE2eHooks();
        }
    }).catch((err) => {
        log.error('Failed to register extended e2e hooks', {err});
    });
}
