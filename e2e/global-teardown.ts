// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {cleanupAllRegisteredElectronProcesses} from './helpers/electronApp';

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

export default async function globalTeardown() {
    restoreMacOsDefaultsSnapshot();

    // Reap any Electron main processes left registered across all workers (e.g.
    // from workers that crashed or skipped their worker teardown), then remove
    // every registry shard. Shared with the worker-scoped cleanup so the kill
    // strategy lives in one place and stays consistent across platforms.
    await cleanupAllRegisteredElectronProcesses();
}
