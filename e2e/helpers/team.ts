// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {mattermostURL} from './config';
import type {ServerView} from './serverView';

type EnsureResult = {count: number; created: boolean};

/**
 * Ensure the logged-in user belongs to at least 2 teams.
 *
 * Some tests assert on the team sidebar (`#teamSidebarWrapper`), which the
 * webapp only renders when the user is in 2+ teams. Uses the Mattermost REST
 * API from the Electron main process so renderer state/focus cannot break setup.
 */
export async function ensureMultipleTeams(
    app: ElectronApplication,
    win: ServerView,
    webContentsId: number,
): Promise<number> {
    const username = process.env.MM_TEST_USER_NAME;
    const password = process.env.MM_TEST_PASSWORD;
    const serverUrl = (process.env.MM_TEST_SERVER_URL ?? mattermostURL).replace(/\/$/, '');

    if (!username || !password) {
        throw new Error('MM_TEST_USER_NAME and MM_TEST_PASSWORD must be set for ensureMultipleTeams');
    }

    const result = await app.evaluate(async (_, payload) => {
        const loginRes = await fetch(`${payload.serverUrl}/api/v4/users/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({login_id: payload.username, password: payload.password}),
        });
        if (!loginRes.ok) {
            const detail = await loginRes.text();
            throw new Error(`POST /api/v4/users/login failed: ${loginRes.status} ${detail}`);
        }

        const loginBody = await loginRes.json() as {token?: string};
        const token = loginRes.headers.get('Token') ?? loginBody.token;
        if (!token) {
            throw new Error('POST /api/v4/users/login did not return a session token');
        }
        const authHeaders = {Authorization: `Bearer ${token}`};

        const teamsRes = await fetch(`${payload.serverUrl}/api/v4/users/me/teams`, {headers: authHeaders});
        if (!teamsRes.ok) {
            throw new Error(`GET /api/v4/users/me/teams failed: ${teamsRes.status} ${teamsRes.statusText}`);
        }
        const existing = await teamsRes.json() as unknown[];
        if (existing.length >= 2) {
            return {count: existing.length, created: false};
        }

        const suffix = Math.floor(Math.random() * 1e9).toString(36);
        const createRes = await fetch(`${payload.serverUrl}/api/v4/teams`, {
            method: 'POST',
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `e2e-${suffix}`,
                display_name: `E2E ${suffix}`,
                type: 'O',
            }),
        });
        if (!createRes.ok) {
            const detail = await createRes.text();
            throw new Error(`POST /api/v4/teams failed: ${createRes.status} ${detail}`);
        }

        const refreshed = await fetch(`${payload.serverUrl}/api/v4/users/me/teams`, {headers: authHeaders});
        const teams = await refreshed.json() as unknown[];
        return {count: teams.length, created: true};
    }, {serverUrl, username, password}) as EnsureResult;

    if (result.created) {
        await app.evaluate(async ({webContents}, id) => {
            const wc = webContents.fromId(id);
            if (!wc || wc.isDestroyed()) {
                throw new Error(`webContents ${id} is not available`);
            }
            await wc.executeJavaScript('window.location.reload()', true);
        }, webContentsId);
        await win.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    }

    if (result.count < 2) {
        throw new Error(`Expected at least 2 teams after ensureMultipleTeams, got ${result.count}`);
    }

    return result.count;
}
