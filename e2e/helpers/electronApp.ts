// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitForLockFileRelease} from './cleanup';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

export async function waitForWindow(app: ElectronApplication, pattern: string, timeout = 30_000) {
    const timeoutAt = Date.now() + timeout;
    while (Date.now() < timeoutAt) {
        const win = app.windows().find((window) => {
            try {
                return window.url().includes(pattern);
            } catch {
                return false;
            }
        });

        if (win) {
            await win.waitForLoadState().catch(() => {});
            return win;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for window matching "${pattern}"`);
}

export async function closeElectronApp(app: ElectronApplication, dataDir: string) {
    let pid: number | undefined;
    try {
        pid = app.process()?.pid;
    } catch {
        pid = undefined;
    }

    let cleanClosed = false;
    await Promise.race([
        app.close().catch(() => {}).then(() => {
            cleanClosed = true;
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);

    if (!cleanClosed && pid) {
        try {
            process.kill(pid, 'SIGTERM');
        } catch {
            // already exited
        }
    }

    await waitForLockFileRelease(dataDir).catch(() => {});
}
