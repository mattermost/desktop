// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerView} from './serverView';

type EnsureResult = {count: number; created: boolean};

/**
 * Ensure the logged-in user belongs to at least 2 teams.
 *
 * Some tests assert on the team sidebar (`#teamSidebarWrapper`), which the
 * webapp only renders when the user is in 2+ teams. This helper uses the
 * renderer's existing session (cookie auth + CSRF) to create a throwaway
 * team via the Mattermost REST API if needed.
 */
export async function ensureMultipleTeams(win: ServerView): Promise<number> {
    const result = await win.runInRenderer<EnsureResult>(`
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
            throw new Error(
                'POST /api/v4/teams failed: ' + createRes.status + ' ' + createRes.statusText + ' — ' + detail,
            );
        }

        const refreshed = await fetch('/api/v4/users/me/teams', {credentials: 'include'});
        const teams = await refreshed.json();
        return {count: teams.length, created: true};
    `);

    if (result.created) {
        await win.runInRenderer('window.location.reload(); return true;', true);
        await win.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    }

    if (result.count < 2) {
        throw new Error(`Expected at least 2 teams after ensureMultipleTeams, got ${result.count}`);
    }

    return result.count;
}
