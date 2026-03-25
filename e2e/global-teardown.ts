// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const E2E_PROCESS_REGISTRY = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');

/**
 * Kill any main Electron processes still running from this test suite.
 *
 * Main test processes append their PID to a temp registry during startup.
 * Teardown kills only those registered main-process PIDs, avoiding broad shell
 * matching across unrelated Electron helper processes.
 */
export default async function globalTeardown() {
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

        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline) {
            if (!isProcessAlive(pid)) {
                break;
            }
            await sleep(200);
        }

        if (isProcessAlive(pid)) {
            try {
                process.kill(pid, 'SIGKILL');
            } catch {
                // already exited
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
