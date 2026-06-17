// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {waitForLockFileRelease} from './cleanup';
import {closeOverlayWindowsIfOpen} from './overlayWindows';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

const E2E_PROCESS_REGISTRY = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');

export type CloseElectronAppOptions = {
    skipLockWaitUnlessCleanClose?: boolean;
};

export function registerElectronMainProcess(pid: number | undefined) {
    if (!pid) {
        return;
    }
    try {
        fs.appendFileSync(E2E_PROCESS_REGISTRY, `${pid}\n`, 'utf8');
    } catch {
        // non-fatal
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!isProcessAlive(pid)) {
            return true;
        }
        await sleep(200);
    }
    return !isProcessAlive(pid);
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
    try {
        process.kill(-pid, signal);
    } catch {
        try {
            process.kill(pid, signal);
        } catch {
            // already exited
        }
    }
}

function forceKillLinuxProcessTree(pid: number): void {
    try {
        execFileSync('pkill', ['-KILL', '-P', String(pid)], {stdio: 'ignore'});
    } catch {
        // no child processes
    }
    signalProcessGroup(pid, 'SIGKILL');
}

async function requestAppQuit(app: ElectronApplication): Promise<void> {
    await Promise.race([
        app.evaluate(({app: electronApp}) => {
            const refs = (global as any).__e2eTestRefs;
            const mainWindow = refs?.MainWindow?.get?.();
            if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
                mainWindow.show();
            }
            electronApp.quit();
        }).catch(() => {}),
        sleep(3_000),
    ]);
}

async function forceShutdownLinux(pid: number): Promise<void> {
    if (!isProcessAlive(pid)) {
        return;
    }

    signalProcessGroup(pid, 'SIGTERM');
    if (await waitForProcessExit(pid, 3_000)) {
        return;
    }

    forceKillLinuxProcessTree(pid);
    await waitForProcessExit(pid, 10_000);
}

function signalShutdownAndReturn(pid: number): void {
    if (process.platform === 'win32') {
        try {
            execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {stdio: 'ignore'});
        } catch {
            // already exited
        }
        return;
    }

    try {
        process.kill(pid, 'SIGTERM');
    } catch {
        // already exited
    }
}

async function attemptClose(app: ElectronApplication, timeoutMs: number): Promise<boolean> {
    let closed = false;
    await Promise.race([
        app.close().catch(() => {}).then(() => {
            closed = true;
        }),
        sleep(timeoutMs),
    ]);
    return closed;
}

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

        await sleep(200);
    }

    throw new Error(`Timed out waiting for window matching "${pattern}"`);
}

export async function closeElectronApp(
    app: ElectronApplication,
    dataDir?: string,
    options: CloseElectronAppOptions = {},
) {
    let pid: number | undefined;
    try {
        pid = app.process()?.pid;
    } catch {
        pid = undefined;
    }

    if (process.platform === 'linux') {
        await closeOverlayWindowsIfOpen(app).catch(() => {});
        await requestAppQuit(app);

        let cleanClosed = false;
        const closePromise = app.close().catch(() => {}).then(() => {
            cleanClosed = true;
        });
        await Promise.race([closePromise, sleep(10_000)]);

        if (pid && (!cleanClosed || isProcessAlive(pid))) {
            await forceShutdownLinux(pid);
            await Promise.race([closePromise, sleep(5_000)]);
            cleanClosed = cleanClosed || !(pid && isProcessAlive(pid));
        }

        const shouldWaitForLock = Boolean(dataDir) &&
            (!options.skipLockWaitUnlessCleanClose || cleanClosed);
        if (shouldWaitForLock && dataDir) {
            await waitForLockFileRelease(dataDir).catch(() => {});
        }
        return;
    }

    const cleanClosed = await attemptClose(app, 10_000);
    if (!cleanClosed && pid) {
        signalShutdownAndReturn(pid);
        if (options.skipLockWaitUnlessCleanClose) {
            return;
        }
    }

    if (dataDir) {
        await waitForLockFileRelease(dataDir).catch(() => {});
    }
}
