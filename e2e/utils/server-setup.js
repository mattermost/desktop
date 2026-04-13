// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable no-console -- intentional logging in setup scripts */

/**
 * Mattermost server provisioning helper.
 *
 * Runs once before the E2E suite starts (called from global-setup.ts).
 * Uses the Mattermost REST API to ensure a default team and the test admin
 * user exist so that:
 *   - Login does not land on /select_team (no-team fresh servers).
 *   - All server-backed tests can navigate to channels immediately.
 *
 * Idempotent: safe to call multiple times. Already-existing resources are
 * detected and skipped; no error is thrown.
 *
 * Required env vars (all optional — the function no-ops when absent):
 *   MM_TEST_SERVER_URL  e.g. https://desktop-pr-3773-linux-xxx.test.mattermost.cloud
 *   MM_TEST_USER_NAME   admin username  (default: admin)
 *   MM_TEST_PASSWORD    admin password
 */

const DEFAULT_TEAM_NAME = 'e2e-team';
const DEFAULT_TEAM_DISPLAY_NAME = 'E2E Test Team';
const DEFAULT_CHANNEL = 'town-square';

/**
 * Thin wrapper around fetch that throws on non-2xx with a readable message.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<unknown>}
 */
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
    });

    const text = await response.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = text;
    }

    if (!response.ok) {
        const status = response.status;
        const message = typeof body === 'object' ? (body.message ?? JSON.stringify(body)) : body;
        throw new Error(`API ${options.method ?? 'GET'} ${url} → ${status}: ${message}`);
    }

    return body;
}

/**
 * Provision the test server so the admin user lands in a channel after login.
 *
 * Steps (all idempotent):
 *   1. Authenticate as the admin user → obtain session token.
 *   2. Ensure a team named DEFAULT_TEAM_NAME exists (create if absent).
 *   3. Ensure the admin user is a member of that team.
 *
 * @returns {Promise<void>}
 */
async function provisionServer() {
    const serverURL = process.env.MM_TEST_SERVER_URL;
    const username = process.env.MM_TEST_USER_NAME ?? 'admin';
    const password = process.env.MM_TEST_PASSWORD;

    if (!serverURL || !password) {
        console.log('[server-setup] MM_TEST_SERVER_URL or MM_TEST_PASSWORD not set — skipping server provisioning.');
        return;
    }

    const base = serverURL.replace(/\/$/, '');
    console.log(`[server-setup] Provisioning server: ${base}`);

    // ── 1. Login ────────────────────────────────────────────────────────────
    let token;
    let adminUser;
    try {
        const response = await fetch(`${base}/api/v4/users/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({login_id: username, password}),
        });

        const text = await response.text();
        let body;
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }

        if (!response.ok) {
            const msg = typeof body === 'object' ? (body.message ?? JSON.stringify(body)) : body;
            throw new Error(`Login failed (${response.status}): ${msg}`);
        }

        token = response.headers.get('Token');
        adminUser = body;

        if (!token) {
            throw new Error('Login succeeded but no Token header was returned');
        }
    } catch (err) {
        console.warn(`[server-setup] Login failed — skipping provisioning: ${err.message}`);
        return;
    }

    const authHeaders = {Authorization: `Bearer ${token}`};
    console.log(`[server-setup] Authenticated as ${adminUser.username} (id: ${adminUser.id})`);

    // ── 2. Ensure the default team exists ───────────────────────────────────
    let teamId;
    try {
        // Search by exact name
        const teams = await apiRequest(
            `${base}/api/v4/teams/name/${DEFAULT_TEAM_NAME}`,
            {headers: authHeaders},
        );
        teamId = teams.id;
        console.log(`[server-setup] Team '${DEFAULT_TEAM_NAME}' already exists (id: ${teamId})`);
    } catch (err) {
        if (!err.message.includes('404')) {
            console.warn(`[server-setup] Could not check team existence: ${err.message}`);
            return;
        }

        // Team does not exist — create it
        try {
            const newTeam = await apiRequest(`${base}/api/v4/teams`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    name: DEFAULT_TEAM_NAME,
                    display_name: DEFAULT_TEAM_DISPLAY_NAME,
                    type: 'O', // open team
                }),
            });
            teamId = newTeam.id;
            console.log(`[server-setup] Created team '${DEFAULT_TEAM_NAME}' (id: ${teamId})`);
        } catch (createErr) {
            console.warn(`[server-setup] Could not create team: ${createErr.message}`);
            return;
        }
    }

    // ── 3. Ensure the admin user is a member of the team ────────────────────
    try {
        await apiRequest(`${base}/api/v4/teams/${teamId}/members`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                team_id: teamId,
                user_id: adminUser.id,
            }),
        });
        console.log(`[server-setup] Admin user added to team '${DEFAULT_TEAM_NAME}'`);
    } catch (err) {
        // 409 Conflict means the user is already a member — that's fine.
        if (err.message.includes('409') || err.message.toLowerCase().includes('already')) {
            console.log(`[server-setup] Admin user already a member of '${DEFAULT_TEAM_NAME}'`);
        } else {
            console.warn(`[server-setup] Could not add user to team: ${err.message}`);
        }
    }

    // ── 4. Verify the default channel exists ────────────────────────────────
    // town-square is created automatically with every team, but log it for
    // visibility so CI operators can confirm the expected state.
    try {
        const channel = await apiRequest(
            `${base}/api/v4/teams/${teamId}/channels/name/${DEFAULT_CHANNEL}`,
            {headers: authHeaders},
        );
        console.log(`[server-setup] Default channel '${channel.name}' confirmed (id: ${channel.id})`);
    } catch {
        // Non-fatal — just skip the log
    }

    console.log('[server-setup] Server provisioning complete.');
}

module.exports = {provisionServer};
