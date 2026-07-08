// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {ensureElectronBinary} from './helpers/config';
import {clearAllRegistryFiles} from './helpers/electronApp';

const MACOS_DEFAULTS_SNAPSHOT = path.join(os.tmpdir(), 'mattermost-desktop-e2e-macos-defaults-snapshot.json');

function readMacOsDefault(domain: string, key: string): string | null {
    try {
        return execFileSync('defaults', ['read', domain, key], {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
    } catch {
        return null;
    }
}

export default async function globalSetup() {
    ensureElectronBinary();

    // Clear stale per-worker PID shards (and any legacy shared file) from a
    // prior crashed run. We only delete files here, never signal pids, because
    // pids may have been reused by unrelated processes since that run.
    try {
        clearAllRegistryFiles();
    } catch {
        // ignore stale registry cleanup failures
    }

    if (process.platform === 'darwin') {
        const bundleIDs = ['com.github.Electron'];

        for (const bundleID of bundleIDs) {
            try {
                execFileSync('defaults', ['write', bundleID, 'NSQuitAlwaysKeepsWindows', '-bool', 'false'], {stdio: 'pipe'});
            } catch {
                // non-fatal
            }
            try {
                execFileSync('defaults', ['write', bundleID, 'ApplePersistenceIgnoreState', '-bool', 'YES'], {stdio: 'pipe'});
            } catch {
                // non-fatal
            }
        }

        try {
            const snapshot = {
                LSQuarantine: readMacOsDefault('com.apple.LaunchServices', 'LSQuarantine'),
                DialogType: readMacOsDefault('com.apple.CrashReporter', 'DialogType'),
            };
            fs.writeFileSync(MACOS_DEFAULTS_SNAPSHOT, JSON.stringify(snapshot), 'utf8');
        } catch {
            // non-fatal
        }

        try {
            execFileSync('defaults', ['write', 'com.apple.LaunchServices', 'LSQuarantine', '-bool', 'false'], {stdio: 'pipe'});
        } catch {
            // non-fatal
        }

        try {
            execFileSync('defaults', ['write', 'com.apple.CrashReporter', 'DialogType', 'none'], {stdio: 'pipe'});
        } catch {
            // non-fatal
        }
    }
}
