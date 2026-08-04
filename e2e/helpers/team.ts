// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {apiLogin} from './server_api/client';
import {getTestServerCredentials} from './server_api/credentials';
import {apiDeleteTeam, ensureUserHasMultipleTeams} from './server_api/team';
import type {ServerView} from './serverView';

export type EnsureMultipleTeamsResult = {
    count: number;

    /**
     * Deletes the team this call created, if any (no-op otherwise). The shared test
     * server would otherwise accumulate an "e2e-<random>" team every run against an
     * account with fewer than 2 teams. Best-effort: logs rather than throws, so a
     * cleanup failure doesn't mask the actual test's pass/fail result.
     */
    cleanup: () => Promise<void>;
};

/**
 * Ensure the logged-in user belongs to at least 2 teams.
 *
 * Some tests assert on the team sidebar (`#teamSidebarWrapper`), which the
 * webapp only renders when the user is in 2+ teams. Uses the Mattermost REST
 * API (same pattern as mattermost-mobile detox server_api).
 */
export async function ensureMultipleTeams(
    app: ElectronApplication,
    win: ServerView,
    webContentsId: number,
): Promise<EnsureMultipleTeamsResult> {
    const {baseUrl, username, password} = getTestServerCredentials();

    const result = await ensureUserHasMultipleTeams(baseUrl, username, password);

    if (result.count < 2) {
        throw new Error(`Expected at least 2 teams after ensureMultipleTeams, got ${result.count}`);
    }

    if (result.created) {
        await app.evaluate(async ({webContents}, id) => {
            const wc = webContents.fromId(id);
            if (!wc || wc.isDestroyed()) {
                throw new Error(`webContents ${id} is not available`);
            }
            await wc.executeJavaScript('window.location.reload()', true);
        }, webContentsId);
    }

    await win.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    await win.waitForSelector('#teamSidebarWrapper', {state: 'visible', timeout: 30_000});

    const createdTeamId = result.createdTeamId;
    const cleanup = async (): Promise<void> => {
        if (!createdTeamId) {
            return;
        }
        try {
            const token = await apiLogin(baseUrl, username, password);
            await apiDeleteTeam(baseUrl, token, createdTeamId);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
                `ensureMultipleTeams: failed to delete team ${createdTeamId} created for this test run — ` +
                'it will remain on the shared test server.',
                error,
            );
        }
    };

    return {count: result.count, cleanup};
}
