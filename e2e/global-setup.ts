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
        try {
            execSync('defaults write com.github.Electron NSQuitAlwaysKeepsWindows -bool false', {stdio: 'ignore'});
            execSync('defaults write com.github.Electron ApplePersistenceIgnoreState -bool YES', {stdio: 'ignore'});
        } catch {
            // Non-fatal — tests still run, just potentially with the Resume dialog
        }
    }
}
