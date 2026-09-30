// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {ensureElectronBinary} from './helpers/config';
import {clearAllRegistryFiles} from './helpers/electronApp';
import {apiLogin, apiRequest} from './helpers/server_api/client';
import {ensureCallsPlugin} from './helpers/server_api/plugin';

const MACOS_DEFAULTS_SNAPSHOT = path.join(os.tmpdir(), 'mattermost-desktop-e2e-macos-defaults-snapshot.json');

/**
 * Install/enable the Calls plugin and configure it for E2E — exactly once per run,
 * before any worker starts.
 *
 * This MUST NOT move back into a spec's `beforeAll`. `ensureCallsPlugin` disables and
 * re-enables the plugin server-wide to reset its rate limiter, and the Calls specs run
 * across multiple workers (2 in CI on macOS/Windows). A `beforeAll` in one file would
 * tear the plugin down underneath a call another worker had already started — the
 * widget opens, then never finishes connecting. globalSetup runs once with no workers
 * alive, so the same restart is safe here.
 *
 * Throws on failure rather than skipping: a server that cannot run Calls should fail
 * loudly instead of silently yielding a green run with the Calls specs erroring later.
 */
async function setUpCallsPlugin(): Promise<void> {
    const serverUrl = process.env.MM_TEST_SERVER_URL;
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;

    // Same guard the Calls specs use to skip themselves — nothing to set up.
    if (!serverUrl || !username || !password) {
        return;
    }

    // The policy run (`npm run run:policy`) executes only specs/policy and never
    // touches Calls; don't mutate that server's plugin state.
    if (process.env.RUN_POLICY_E2E === 'true') {
        return;
    }

    const token = await apiLogin(serverUrl, username, password);
    await ensureCallsPlugin(serverUrl, token);

    // SiteURL is required by the Calls plugin /logs/upload endpoint to construct DM
    // links in ephemeral posts. Setting it here means the config_changed WebSocket
    // event and any resulting webapp reload land long before the first spec runs.
    await apiRequest(serverUrl, token, '/api/v4/config/patch', {
        method: 'PUT',
        body: JSON.stringify({ServiceSettings: {SiteURL: serverUrl}}),
    });
}

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

    // Last, so a server-side failure cannot leave the local/OS setup above half-done.
    await setUpCallsPlugin();
}
