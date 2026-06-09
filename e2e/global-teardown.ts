// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const E2E_PROCESS_REGISTRY = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');
const MACOS_DEFAULTS_SNAPSHOT = path.join(os.tmpdir(), 'mattermost-desktop-e2e-macos-defaults-snapshot.json');

function restoreMacOsDefaultsSnapshot() {
    if (process.platform !== 'darwin') {
        return;
    }
    try {
        if (!fs.existsSync(MACOS_DEFAULTS_SNAPSHOT)) {
            return;
        }
        const raw = fs.readFileSync(MACOS_DEFAULTS_SNAPSHOT, 'utf8');
        fs.rmSync(MACOS_DEFAULTS_SNAPSHOT, {force: true});
        const snap = JSON.parse(raw) as {LSQuarantine: string | null; DialogType: string | null};

        const restoreKey = (domain: string, key: string, previous: string | null) => {
            try {
                if (previous === null) {
                    execFileSync('defaults', ['delete', domain, key], {stdio: 'ignore'});
                    return;
                }
                if (previous === '0' || previous === '1') {
                    execFileSync('defaults', ['write', domain, key, '-bool', previous === '1' ? 'true' : 'false'], {stdio: 'pipe'});
                    return;
                }
                execFileSync('defaults', ['write', domain, key, '-string', previous], {stdio: 'pipe'});
            } catch {
                // best-effort restore
            }
        };

        restoreKey('com.apple.LaunchServices', 'LSQuarantine', snap.LSQuarantine ?? null);
        restoreKey('com.apple.CrashReporter', 'DialogType', snap.DialogType ?? null);
    } catch {
        // ignore
    }
}

/**
 * Kill any main Electron processes still running from this test suite.
 *
 * Main test processes append their PID to a temp registry during startup.
 * Teardown kills only those registered main-process PIDs, avoiding broad shell
 * matching across unrelated Electron helper processes.
 */
export default async function globalTeardown() {
    restoreMacOsDefaultsSnapshot();

    let pids: number[] = [];
    try {
        if (fs.existsSync(E2E_PROCESS_REGISTRY)) {
            pids = Array.from(new Set(
                fs.readFileSync(E2E_PROCESS_REGISTRY, 'utf8').
                    split(/\s+/).
                    map((value) => Number.parseInt(value, 10)).
                    filter((value) => Number.isInteger(value) && value > 0),
            ));
        }
        fs.rmSync(E2E_PROCESS_REGISTRY, {force: true});
    } catch {
        pids = [];
    }

    for (const pid of pids) {
        if (process.platform === 'win32') {
            try {
                execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {stdio: 'ignore'});
            } catch {
                // already exited
            }
            continue;
        }

        if (!isProcessAlive(pid)) {
            continue;
        }

        try {
            process.kill(pid, 'SIGTERM');
        } catch {
            continue;
        }

        // Give the process time to exit gracefully.
        // On macOS, use a longer wait since Electron shutdown can be slow.
        const waitMs = process.platform === 'darwin' ? 10_000 : 5_000;
        const deadline = Date.now() + waitMs;
        while (Date.now() < deadline) {
            if (!isProcessAlive(pid)) {
                break;
            }
            await sleep(200);
        }

        if (isProcessAlive(pid)) {
            // On macOS, SIGKILL triggers the "quit unexpectedly" crash dialog
            // which blocks subsequent Electron launches. Skip SIGKILL and let
            // the process linger — global-setup clears the registry, and each
            // test uses a unique userDataDir so orphans never block new tests.
            if (process.platform !== 'darwin') {
                try {
                    process.kill(pid, 'SIGKILL');
                } catch {
                    // already exited
                }
            }
        }
    }
}

function isProcessAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
