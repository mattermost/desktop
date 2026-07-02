// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {apiLogin, apiRequest} from './client';

type TeamPayload = {
    name: string;
    display_name: string;
    type: string;
};

type CreatedTeam = TeamPayload & {id: string};

export function generateRandomTeam(type = 'O', prefix = 'e2e'): TeamPayload {
    const suffix = Math.floor(Math.random() * 1e9).toString(36);

    return {
        name: `${prefix}-${suffix}`,
        display_name: `E2E ${suffix}`,
        type,
    };
}

export async function apiGetTeamsForUser(baseUrl: string, token: string, userId = 'me'): Promise<unknown[]> {
    return apiRequest<unknown[]>(baseUrl, token, `/api/v4/users/${userId}/teams`);
}

export async function apiCreateTeam(
    baseUrl: string,
    token: string,
    team: TeamPayload = generateRandomTeam(),
): Promise<CreatedTeam> {
    return apiRequest<CreatedTeam>(baseUrl, token, '/api/v4/teams', {
        method: 'POST',
        body: JSON.stringify(team),
    });
}

/**
 * Delete a team created for a test, so the shared test server doesn't accumulate them.
 * Permanent deletion requires ServiceSettings.EnableAPITeamDeletion on the server; if
 * that's not enabled, falls back to a soft delete (archive), which still removes it
 * from the user's active team list.
 */
export async function apiDeleteTeam(baseUrl: string, token: string, teamId: string): Promise<void> {
    try {
        await apiRequest<unknown>(baseUrl, token, `/api/v4/teams/${teamId}?permanent=true`, {method: 'DELETE'});
    } catch {
        await apiRequest<unknown>(baseUrl, token, `/api/v4/teams/${teamId}`, {method: 'DELETE'});
    }
}

export async function ensureUserHasMultipleTeams(
    baseUrl: string,
    loginId: string,
    password: string,
): Promise<{count: number; created: boolean; createdTeamId?: string}> {
    const token = await apiLogin(baseUrl, loginId, password);
    const existing = await apiGetTeamsForUser(baseUrl, token);
    if (existing.length >= 2) {
        return {count: existing.length, created: false};
    }

    const createdTeam = await apiCreateTeam(baseUrl, token);
    const teams = await apiGetTeamsForUser(baseUrl, token);
    return {count: teams.length, created: true, createdTeamId: createdTeam.id};
}
