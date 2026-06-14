// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {mattermostURL} from './config';
import type {ServerView} from './serverView';

type EnsureResult = {count: number; created: boolean};

const RENDERER_ENSURE_TEAMS = `
(async () => {
    const getCsrf = () => {
        const match = document.cookie.match(/(?:^|;)\\s*MMCSRF=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const meTeamsRes = await fetch('/api/v4/users/me/teams', {credentials: 'include'});
    if (!meTeamsRes.ok) {
        throw new Error('GET /api/v4/users/me/teams failed: ' + meTeamsRes.status + ' ' + meTeamsRes.statusText);
    }
    const existing = await meTeamsRes.json();
    if (existing.length >= 2) {
        return {count: existing.length, created: false};
    }

    const suffix = Math.floor(Math.random() * 1e9).toString(36);
    const createRes = await fetch('/api/v4/teams', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({
            name: 'e2e-' + suffix,
            display_name: 'E2E ' + suffix,
            type: 'O',
        }),
    });
    if (!createRes.ok) {
        const detail = await createRes.text();
        throw new Error('POST /api/v4/teams failed: ' + createRes.status + ' — ' + detail);
    }

    const refreshed = await fetch('/api/v4/users/me/teams', {credentials: 'include'});
    const teams = await refreshed.json();
    return {count: teams.length, created: true};
})()
`;

async function ensureMultipleTeamsViaApi(
    app: ElectronApplication,
    serverUrl: string,
    username: string,
    password: string,
): Promise<EnsureResult> {
    return app.evaluate(async (_, payload) => {
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
        const headerToken = loginRes.headers.get('Token') ?? loginRes.headers.get('token');
        const setCookie = loginRes.headers.get('set-cookie') ?? '';
        const cookieMatch = setCookie.match(/MMAUTHTOKEN=([^;]+)/i);
        const token = headerToken
            ?? loginBody.token
            ?? (cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined);
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
    }, {serverUrl, username, password}) as Promise<EnsureResult>;
}

/**
 * Ensure the logged-in user belongs to at least 2 teams.
 *
 * Some tests assert on the team sidebar (`#teamSidebarWrapper`), which the
 * webapp only renders when the user is in 2+ teams. Prefer the renderer's
 * authenticated session (call after loginToMattermost); fall back to a
 * main-process REST login when the server view is not ready yet.
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

    let result: EnsureResult;
    try {
        result = await app.evaluate(async ({webContents}, payload) => {
            const wc = webContents.fromId(payload.id);
            if (!wc || wc.isDestroyed()) {
                throw new Error(`webContents ${payload.id} is not available`);
            }
            return wc.executeJavaScript(payload.script) as Promise<EnsureResult>;
        }, {id: webContentsId, script: RENDERER_ENSURE_TEAMS});
    } catch {
        result = await ensureMultipleTeamsViaApi(app, serverUrl, username, password);
    }

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
