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

    /**
     * Fixture teardown only: each test uses a unique userDataDir, so skip
     * SingletonLock polling when app.close() hung and we had to force-kill.
     * Direct-launch specs that reuse the same dir must leave this false.
     */
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

function signalProcessTree(pid: number, signal: NodeJS.Signals): void {
    if (process.platform === 'linux') {
        // Playwright maintainer recommendation for leaky Electron subprocesses on
        // Linux: signal the process group so renderer/GPU children exit too.
        try {
            process.kill(-pid, signal);
            return;
        } catch {
            // Fall through when the PID is not a group leader.
        }
    }

    try {
        process.kill(pid, signal);
    } catch {
        // already exited
    }
}

function forceKillProcessTree(pid: number): void {
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
        signalProcessTree(pid, 'SIGKILL');
        return;
    }

    try {
        process.kill(pid, 'SIGKILL');
    } catch {
        // already exited
    }
}

async function requestQuitViaMainProcess(app: ElectronApplication): Promise<void> {
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

async function forceShutdownElectron(pid: number): Promise<void> {
    if (!isProcessAlive(pid)) {
        return;
    }

    if (process.platform === 'win32') {
        try {
            execFileSync('taskkill', ['/PID', String(pid), '/T'], {stdio: 'ignore'});
        } catch {
            // already exited
        }
        if (await waitForProcessExit(pid, 5_000)) {
            return;
        }
        forceKillProcessTree(pid);
        await waitForProcessExit(pid, 10_000);
        return;
    }

    signalProcessTree(pid, 'SIGTERM');
    if (await waitForProcessExit(pid, 3_000)) {
        return;
    }

    // macOS skips SIGKILL because it triggers the "Electron quit unexpectedly"
    // crash dialog which blocks subsequent launches.
    if (process.platform === 'darwin') {
        return;
    }

    forceKillProcessTree(pid);
    await waitForProcessExit(pid, 10_000);
}

async function drainPlaywrightClose(closePromise: Promise<void>): Promise<void> {
    // Playwright keeps a gracefullyClose entry until app.close() settles
    // (see microsoft/playwright#29431). Drain it after force-kill so the worker
    // does not sit in teardown until the 90s worker timeout.
    await Promise.race([closePromise, sleep(5_000)]);
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

    await closeOverlayWindowsIfOpen(app).catch(() => {});
    await requestQuitViaMainProcess(app);

    let cleanClosed = false;
    const closePromise = app.close().catch(() => {}).then(() => {
        cleanClosed = true;
    });
    await Promise.race([
        closePromise,
        sleep(10_000),
    ]);

    if (!cleanClosed && pid) {
        await forceShutdownElectron(pid);
        await drainPlaywrightClose(closePromise);
        cleanClosed = await waitForProcessExit(pid, 1_000).then((exited) => exited || cleanClosed);
    }

    if (pid && isProcessAlive(pid)) {
        await forceShutdownElectron(pid);
        await drainPlaywrightClose(closePromise);
    }

    const shouldWaitForLock = Boolean(dataDir) &&
        (!options.skipLockWaitUnlessCleanClose || cleanClosed);
    if (shouldWaitForLock && dataDir) {
        await waitForLockFileRelease(dataDir).catch(() => {});
    }
}
