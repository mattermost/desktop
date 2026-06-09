// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const E2E_PROCESS_REGISTRY = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');
const MACOS_DEFAULTS_SNAPSHOT = path.join(os.tmpdir(), 'mattermost-desktop-e2e-macos-defaults-snapshot.json');

function readMacOsDefault(domain: string, key: string): string | null {
    try {
        return execFileSync('defaults', ['read', domain, key], {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
    } catch {
        return null;
    }
}

/**
 * Disable macOS window-restoration (Resume) for the Electron binary used in tests.
 *
 * When Electron is killed by a signal (SIGTERM from fixture teardown or SIGKILL from
 * Playwright's worker timeout), macOS marks the process as having "quit unexpectedly"
 * and shows a "Do you want to reopen its windows?" dialog on the next launch.
 * That dialog blocks the app UI, so __e2eAppReady is never set, waitForAppReady times
 * out, and fixture teardown hangs — causing more kills, more dialogs, and so on.
 *
 * NSQuitAlwaysKeepsWindows = false  — don't offer to restore windows after unexpected quit
 * ApplePersistenceIgnoreState = YES — skip saved-state restoration on every launch
 */
export default async function globalSetup() {
    try {
        fs.rmSync(E2E_PROCESS_REGISTRY, {force: true});
    } catch {
        // ignore stale registry cleanup failures
    }

    if (process.platform === 'darwin') {
        // Multiple bundle IDs may be involved: com.github.Electron (Electron binary
        // launched directly) and the app's own bundle ID (when running signed builds).
        const bundleIDs = ['com.github.Electron'];

        for (const bundleID of bundleIDs) {
            try {
                execFileSync('defaults', ['write', bundleID, 'NSQuitAlwaysKeepsWindows', '-bool', 'false'], {stdio: 'pipe'});
            } catch {
                // Non-fatal — tests still run, just potentially with the Resume dialog
            }
            try {
                execFileSync('defaults', ['write', bundleID, 'ApplePersistenceIgnoreState', '-bool', 'YES'], {stdio: 'pipe'});
            } catch {
                // Non-fatal
            }
        }

        // Snapshot system defaults we are about to override so global-teardown
        // can restore them (or delete keys that did not exist before).
        try {
            const snapshot = {
                LSQuarantine: readMacOsDefault('com.apple.LaunchServices', 'LSQuarantine'),
                DialogType: readMacOsDefault('com.apple.CrashReporter', 'DialogType'),
            };
            fs.writeFileSync(MACOS_DEFAULTS_SNAPSHOT, JSON.stringify(snapshot), 'utf8');
        } catch {
            // Non-fatal — teardown will skip restore if file missing
        }

        // Apply system-level settings to suppress macOS dialogs that block
        // Electron startup. These target system domains (LaunchServices,
        // CrashReporter) rather than per-app bundle IDs.
        try {
            execFileSync('defaults', ['write', 'com.apple.LaunchServices', 'LSQuarantine', '-bool', 'false'], {stdio: 'pipe'});
        } catch {
            // Non-fatal
        }

        // Suppress the macOS crash dialog ("Electron quit unexpectedly") that
        // appears when a process exits via SIGTERM or other unexpected quits.
        try {
            execFileSync('defaults', ['write', 'com.apple.CrashReporter', 'DialogType', 'none'], {stdio: 'pipe'});
        } catch {
            // Non-fatal
        }
    }
}
