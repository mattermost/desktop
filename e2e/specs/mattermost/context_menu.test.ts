// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {ensureMultipleTeams} from '../../helpers/team';

// ── MM-T1307: Right-click a channel name / team name in LHS ────────────
// Verifies that the context menu appears with expected channel actions when
// right-clicking a sidebar channel, and that the team context menu appears
// when right-clicking the team name.

test.describe('mattermost/context_menu', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test.beforeAll(async ({serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
        expect(firstServer, 'Mattermost server view should exist').toBeTruthy();

        await loginToMattermost(firstServer!);
        await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    });

    test('MM-T1307 Right-click a channel name in LHS shows context menu',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            // Right-click Town Square channel in the sidebar
            await firstServer!.click('#sidebarItem_town-square', {button: 'right'});

            // Context menu must appear
            const menuItem = await firstServer!.waitForSelector('.Menu .MenuItem', {timeout: 5_000});
            expect(menuItem, 'Context menu must appear on right-click').toBeTruthy();

            // Assert specific menu items from MM-T1307 acceptance criteria:
            // "Copy Link" must be present for channel context menu
            const hasCopyLink = await firstServer!.evaluate(() => {
                const items = document.querySelectorAll('.Menu .MenuItem');
                return Array.from(items).some(
                    (item) => (item.textContent ?? '').trim() === 'Copy Link',
                );
            });
            expect(hasCopyLink, '"Copy Link" must appear in channel context menu').toBe(true);

            // Close menu
            await firstServer!.click('#channelHeaderTitle');
        },
    );

    test('MM-T1307_2 Right-click a team name in LHS shows context menu',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            // The team sidebar (`#teamSidebarWrapper`) only renders when the user
            // is in 2+ teams. Ensure that precondition via the REST API, then
            // wait for the sidebar to render before right-clicking a team button.
            await ensureMultipleTeams(firstServer!);
            await firstServer!.waitForSelector('#teamSidebarWrapper [id$="TeamButton"]', {timeout: 15_000});

            await firstServer!.click('#teamSidebarWrapper [id$="TeamButton"]', {button: 'right'});

            const menuItem = await firstServer!.waitForSelector('.Menu .MenuItem', {timeout: 5_000});
            expect(menuItem, 'Team context menu must appear on right-click').toBeTruthy();

            await firstServer!.click('#channelHeaderTitle');
        },
    );
});
