// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerView} from './serverView';

type Team = {id: string; name: string; display_name: string};
type EnsureResult = {teams: Team[]; created: boolean};

/**
 * Ensure the logged-in user belongs to at least 2 teams.
 *
 * Some tests assert on the team sidebar (`#teamSidebarWrapper`), which the
 * webapp only renders when the user is in 2+ teams. This helper uses the
 * renderer's existing session (cookie auth + CSRF) to create a throwaway
 * team via the Mattermost REST API if needed, and returns the full team
 * list so callers can target a specific team.
 */
export async function ensureMultipleTeams(win: ServerView): Promise<Team[]> {
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
            return {teams: existing, created: false};
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
        return {teams: await refreshed.json(), created: true};
    `);

    if (result.created) {
        await win.evaluate('window.location.reload()');
        await win.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    }

    return result.teams;
}
