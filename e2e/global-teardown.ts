// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'child_process';

import {appDir} from './helpers/config';

/**
 * Kill any main Electron processes still running from this test suite.
 *
 * Uses `ps | grep | kill` instead of `pkill -f` to avoid killing Electron helper
 * processes (GPU, renderer, plugin). Helper processes share the same app path in
 * their command line (--app-path=e2e/dist) but always include a --type= flag.
 * Killing helpers causes the main Electron process to detect unexpected child death
 * and crash, which triggers the macOS "Electron quit unexpectedly" dialog.
 *
 * Filter: match appDir in command line AND exclude --type= (helpers always have it).
 */
export default async function globalTeardown() {
    try {
        if (process.platform === 'win32') {
            // /FI filters by command line on Windows — kill any electron.exe with appDir in args
            execSync(`taskkill /F /IM electron.exe /FI "COMMANDLINE eq *${appDir}*" 2>nul`, {stdio: 'ignore'});
        } else {
            // Find PIDs whose command line contains appDir but NOT --type= (helpers always have --type=)
            execSync(
                `ps aux | grep "${appDir}" | grep -v -- "--type=" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true`,
                {stdio: 'ignore'},
            );
        }
    } catch {
        // No matching processes is expected — not an error
    }
}
