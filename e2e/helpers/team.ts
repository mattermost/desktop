// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {getTestServerCredentials} from './server_api/credentials';
import {ensureUserHasMultipleTeams} from './server_api/team';
import type {ServerView} from './serverView';

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
): Promise<number> {
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

    return result.count;
}
