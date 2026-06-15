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

        // On Linux/Windows, escalate to SIGKILL if SIGTERM didn't reap the process
        // within a short grace period. A stuck Electron keeps Playwright's RPC
        // channel alive and causes "Worker teardown timeout" failures even though
        // every test passed. macOS skips SIGKILL because it triggers the "Electron
        // quit unexpectedly" crash dialog which blocks subsequent launches.
        if (process.platform !== 'darwin') {
            const stillAlive = await new Promise<boolean>((resolve) => {
                const start = Date.now();
                const interval = setInterval(() => {
                    try {
                        process.kill(pid!, 0);
                    } catch {
                        clearInterval(interval);
                        resolve(false);
                        return;
                    }
                    if (Date.now() - start > 3_000) {
                        clearInterval(interval);
                        resolve(true);
                    }
                }, 200);
            });
            if (stillAlive) {
                try {
                    process.kill(pid, 'SIGKILL');
                } catch {
                    // already exited
                }
            }
        }
    }

    await waitForLockFileRelease(dataDir).catch(() => {});
}
