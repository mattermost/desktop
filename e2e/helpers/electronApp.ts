// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';

import {waitForLockFileRelease} from './cleanup';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

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

function killProcessTree(pid: number): void {
    if (process.platform === 'win32') {
        try {
            execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {stdio: 'ignore'});
        } catch {
            // already exited
        }
        return;
    }

    if (process.platform === 'linux') {
        try {
            execFileSync('pkill', ['-KILL', '-P', String(pid)], {stdio: 'ignore'});
        } catch {
            // no child processes
        }
    }

    try {
        process.kill(pid, 'SIGKILL');
    } catch {
        // already exited
    }
}

async function forceShutdownElectron(pid: number): Promise<void> {
    if (!isProcessAlive(pid)) {
        return;
    }

    try {
        process.kill(pid, 'SIGTERM');
    } catch {
        return;
    }

    if (await waitForProcessExit(pid, 3_000)) {
        return;
    }

    // macOS skips SIGKILL because it triggers the "Electron quit unexpectedly"
    // crash dialog which blocks subsequent launches.
    if (process.platform === 'darwin') {
        return;
    }

    killProcessTree(pid);
    await waitForProcessExit(pid, 10_000);
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

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for window matching "${pattern}"`);
}

export async function closeElectronApp(app: ElectronApplication, dataDir?: string) {
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
        await forceShutdownElectron(pid);
    }

    if (dataDir) {
        await waitForLockFileRelease(dataDir).catch(() => {});
    }
}
