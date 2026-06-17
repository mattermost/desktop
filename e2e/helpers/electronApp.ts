// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {waitForLockFileRelease} from './cleanup';

type ElectronApplication = Awaited<ReturnType<typeof import('playwright')['_electron']['launch']>>;

/**
 * PID registry for orphaned Electron main processes.
 *
 * Each Playwright worker is a separate Node process, so the registry is sharded
 * per worker (`...-<workerPid>.txt`). This avoids the read-modify-write races a
 * single shared file had under fullyParallel: a worker only ever touches its
 * own shard, and tests run serially within a worker, so register/unregister
 * never contend. Worker teardown reaps this worker's shard; global teardown
 * enumerates every shard (plus a legacy shared file from older runs) as the
 * final backstop.
 */
const REGISTRY_DIR = os.tmpdir();
const REGISTRY_PREFIX = 'mattermost-desktop-e2e-main-pids';
const LEGACY_REGISTRY = path.join(REGISTRY_DIR, 'mattermost-desktop-e2e-main-pids.txt');

export type CloseElectronAppOptions = {
    skipLockWaitUnlessCleanClose?: boolean;
};

/** Unique per-test userDataDir (fixture path): abandon fast, reap via worker cleanup. */
export const FAST_TEARDOWN: CloseElectronAppOptions = {
    skipLockWaitUnlessCleanClose: true,
};

/** Convenience wrapper for {@link FAST_TEARDOWN}. */
export async function closeElectronAppFast(
    app: ElectronApplication,
    dataDir?: string,
): Promise<void> {
    return closeElectronApp(app, dataDir, FAST_TEARDOWN);
}

function workerRegistryPath(workerPid: number = process.pid): string {
    return path.join(REGISTRY_DIR, `${REGISTRY_PREFIX}-${workerPid}.txt`);
}

function listRegistryFiles(): string[] {
    const files: string[] = [];
    try {
        for (const entry of fs.readdirSync(REGISTRY_DIR)) {
            if (entry.startsWith(`${REGISTRY_PREFIX}-`) && entry.endsWith('.txt')) {
                files.push(path.join(REGISTRY_DIR, entry));
            }
        }
    } catch {
        // tmpdir unreadable; best-effort
    }
    if (fs.existsSync(LEGACY_REGISTRY)) {
        files.push(LEGACY_REGISTRY);
    }
    return files;
}

function readPidsFromFile(file: string): number[] {
    try {
        if (!fs.existsSync(file)) {
            return [];
        }
        return Array.from(new Set(
            fs.readFileSync(file, 'utf8').
                split(/\s+/).
                map((value) => Number.parseInt(value, 10)).
                filter((value) => Number.isInteger(value) && value > 0),
        ));
    } catch {
        return [];
    }
}

export function registerElectronMainProcess(pid: number | undefined) {
    if (!pid) {
        return;
    }
    try {
        fs.appendFileSync(workerRegistryPath(), `${pid}\n`, 'utf8');
    } catch {
        // non-fatal
    }
}

export function unregisterElectronMainProcess(pid: number | undefined) {
    if (!pid) {
        return;
    }

    // Only the current worker touches its own shard (tests are serial within a
    // worker), so a plain read-modify-write here is race-free.
    const file = workerRegistryPath();
    try {
        if (!fs.existsSync(file)) {
            return;
        }
        const remaining = fs.readFileSync(file, 'utf8').
            split(/\n/).
            filter((line) => {
                const value = Number.parseInt(line.trim(), 10);
                return Number.isInteger(value) && value > 0 && value !== pid;
            });
        if (remaining.length > 0) {
            fs.writeFileSync(file, `${remaining.join('\n')}\n`, 'utf8');
        } else {
            fs.rmSync(file, {force: true});
        }
    } catch {
        // non-fatal
    }
}

/**
 * Reap this worker's registered Electron main processes. Called from the
 * worker-scoped fixture teardown, so it only touches this worker's shard.
 */
export async function cleanupRegisteredElectronProcesses(): Promise<void> {
    const file = workerRegistryPath();
    const pids = readPidsFromFile(file);
    fs.rmSync(file, {force: true});
    await reapPids(pids);
}

/**
 * Reap every worker's registered Electron main processes. Called from global
 * teardown as the final backstop for processes left by workers that crashed or
 * skipped their worker-scoped teardown.
 */
export async function cleanupAllRegisteredElectronProcesses(): Promise<void> {
    const files = listRegistryFiles();
    const pids = Array.from(new Set(files.flatMap(readPidsFromFile)));
    for (const file of files) {
        fs.rmSync(file, {force: true});
    }
    await reapPids(pids);
}

/**
 * Remove every registry shard without reaping. Used at global setup to clear
 * stale files from a prior crashed run; we deliberately do not signal any pids
 * here because they may have been reused by unrelated processes since that run.
 */
export function clearAllRegistryFiles(): void {
    for (const file of listRegistryFiles()) {
        fs.rmSync(file, {force: true});
    }
}

async function reapPids(pids: number[]): Promise<void> {
    if (pids.length === 0) {
        return;
    }

    const alive = pids.filter(isProcessAlive);
    if (alive.length === 0) {
        return;
    }

    for (const pid of alive) {
        if (process.platform === 'linux') {
            signalProcessGroup(pid, 'SIGKILL');
            forceKillLinuxProcessTree(pid);
        } else {
            signalShutdownAndReturn(pid);
        }
    }

    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
        if (alive.every((pid) => !isProcessAlive(pid))) {
            return;
        }
        await sleep(200);
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

async function drainPlaywrightClose(closePromise: Promise<void>): Promise<void> {
    // Playwright keeps a gracefullyClose entry until app.close() settles (#29431).
    // Cap the wait so worker teardown does not hang for 90s when close never settles.
    await Promise.race([closePromise, sleep(3_000)]);
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
    const closePromise = app.close().catch(() => {}).then(() => {
        closed = true;
    });
    await Promise.race([closePromise, sleep(timeoutMs)]);
    await drainPlaywrightClose(closePromise);
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

    // `skipLockWaitUnlessCleanClose` marks a unique per-test userDataDir (the
    // fixture path): teardown abandons fast and lets worker/global cleanup reap
    // orphans, matching master's model. Without it (direct-launch specs), the
    // same userDataDir may be relaunched, so we force-kill on failure (Linux)
    // and always wait for the SingletonLock to release.
    const fastTeardown = Boolean(options.skipLockWaitUnlessCleanClose);

    const cleanClosed = await attemptClose(app, 10_000);

    if (!cleanClosed && pid) {
        if (process.platform === 'linux') {
            // Always SIGKILL stuck trees on Linux so worker teardown does not sit
            // in Playwright's 90s gracefullyClose wait with live Electron PIDs.
            await forceShutdownLinux(pid);
        } else {
            signalShutdownAndReturn(pid);
        }
    }

    // Fast path on a failed close: return immediately (master-style). The lock
    // lives in an abandoned dir and worker/global cleanup reaps any live PID.
    if (fastTeardown && !cleanClosed) {
        if (pid && !isProcessAlive(pid)) {
            unregisterElectronMainProcess(pid);
        }
        return;
    }

    // Full path always waits for the lock; fast path only on a clean close.
    if (dataDir && (cleanClosed || !fastTeardown)) {
        await waitForLockFileRelease(dataDir).catch(() => {});
    }

    // Drop the PID from the registry only once it's actually gone; a live
    // leftover stays for worker/global cleanup to reap (matches master).
    if (!pid || !isProcessAlive(pid)) {
        unregisterElectronMainProcess(pid);
    }
}
