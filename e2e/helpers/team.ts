// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ServerView} from './serverView';

type Team = {id: string; name: string; display_name: string};

/**
 * Ensure the logged-in user belongs to at least 2 teams.
 *
 * Some tests assert on the team sidebar (`#teamSidebarWrapper`), which the
 * webapp only renders when the user is in 2+ teams. This helper uses the
 * renderer's existing session (cookie auth + CSRF) to create a throwaway
 * team via the Mattermost REST API if needed, and returns the full team
 * list so callers can target a specific team.
 *
 * The created team is left in place; the test server is expected to be
 * disposable. If teardown is needed, capture the returned team id and
 * DELETE `/api/v4/teams/<id>?permanent=true` as a system admin.
 */
type EnsureResult = {teams: Team[]; created: boolean};

export async function ensureMultipleTeams(win: ServerView): Promise<Team[]> {
    const result = await win.evaluate(async () => {
        const getCsrf = () => {
            const match = document.cookie.match(/(?:^|;\s*)MMCSRF=([^;]+)/);
            return match ? decodeURIComponent(match[1]) : '';
        };

        const meTeamsRes = await fetch('/api/v4/users/me/teams', {credentials: 'include'});
        if (!meTeamsRes.ok) {
            throw new Error(`GET /api/v4/users/me/teams failed: ${meTeamsRes.status} ${meTeamsRes.statusText}`);
        }
        const existing = (await meTeamsRes.json()) as Team[];
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
                name: `e2e-${suffix}`,
                display_name: `E2E ${suffix}`,
                type: 'O',
            }),
        });
        if (!createRes.ok) {
            const detail = await createRes.text();
            throw new Error(
                `POST /api/v4/teams failed: ${createRes.status} ${createRes.statusText} — ${detail}. ` +
                'The test user may not have permission to create teams; grant `create_team` permission or pre-provision a second team.',
            );
        }

        const refreshed = await fetch('/api/v4/users/me/teams', {credentials: 'include'});
        return {teams: (await refreshed.json()) as Team[], created: true};
    }) as EnsureResult;

    // The webapp store doesn't pick up a freshly-created team without a reload,
    // so `#teamSidebarWrapper` would never render even though the API succeeded.
    if (result.created) {
        await win.evaluate(() => {
            window.location.reload();
        });
    }

    return result.teams;
}
