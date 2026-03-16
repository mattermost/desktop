// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';

import {appDir} from './helpers/config';

/**
 * Kill any Electron processes still running from this test suite.
 * Targets only processes whose command line contains our test app dir (e2e/dist),
 * so it won't affect unrelated Electron apps (VSCode, etc.) on the machine.
 *
 * This prevents singleton lock conflicts between successive test runs.
 */
export default async function globalTeardown() {
    try {
        if (process.platform === 'win32') {
            // /FI filters by command line on Windows — kill any electron.exe with appDir in args
            execSync(`taskkill /F /IM electron.exe /FI "COMMANDLINE eq *${appDir}*" 2>nul`, {stdio: 'ignore'});
        } else {
            // pkill -f matches the full command line; || true suppresses "no process found" exit code
            execSync(`pkill -f "${appDir}" || true`, {stdio: 'ignore'});
        }
    } catch {
        // No matching processes is expected — not an error
    }
}
