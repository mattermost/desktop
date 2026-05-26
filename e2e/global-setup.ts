// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const E2E_PROCESS_REGISTRY = path.join(os.tmpdir(), 'mattermost-desktop-e2e-main-pids.txt');

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
                execSync(`defaults write ${bundleID} NSQuitAlwaysKeepsWindows -bool false`, {stdio: 'pipe'});
            } catch {
                // Non-fatal — tests still run, just potentially with the Resume dialog
            }
            try {
                execSync(`defaults write ${bundleID} ApplePersistenceIgnoreState -bool YES`, {stdio: 'pipe'});
            } catch {
                // Non-fatal
            }
        }

        // Verify at least one bundle ID got the settings applied.
        // Also suppress the "verification of developer" dialog that can appear
        // on first launch of unsigned Electron builds.
        try {
            execSync('defaults write com.apple.LaunchServices LSQuarantine -bool false', {stdio: 'pipe'});
        } catch {
            // Non-fatal
        }

        // Suppress the macOS crash dialog ("Electron quit unexpectedly") that
        // appears when a process is killed by SIGKILL in global-teardown.
        try {
            execSync('defaults write com.apple.CrashReporter DialogType none', {stdio: 'pipe'});
        } catch {
            // Non-fatal
        }
    }
}
