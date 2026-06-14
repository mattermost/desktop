// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {openSidebarChannelMenu} from '../../helpers/channelMenu';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {ensureMultipleTeams} from '../../helpers/team';

// ── MM-T1307: Right-click a channel name / team name in LHS ────────────
// Channel "Copy Link" lives in the webapp's sidebar channel-options menu,
// not the native Electron context menu (see copy_link.test.ts). Team menus
// are driven through the team sidebar once the user belongs to 2+ teams.

test.describe('mattermost/context_menu', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T1307 Right-click a channel name in LHS shows context menu',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            const firstServer = serverEntry?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(firstServer!);
            await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

            await openSidebarChannelMenu(firstServer!, '#sidebarItem_town-square');

            const hasCopyLink = await firstServer!.evaluate(() => {
                const items = document.querySelectorAll('.Menu .MenuItem, [role="menuitem"]');
                return Array.from(items).some(
                    (item) => (item.textContent ?? '').trim() === 'Copy Link',
                );
            });
            expect(hasCopyLink, '"Copy Link" must appear in channel context menu').toBe(true);

            await firstServer!.click('#channelHeaderTitle');
        },
    );

    test('MM-T1307_2 Right-click a team name in LHS shows context menu',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            const firstServer = serverEntry?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(firstServer!);
            await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await ensureMultipleTeams(electronApp, firstServer!, serverEntry!.webContentsId);
            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await firstServer!.waitForSelector('#teamSidebarWrapper [id$="TeamButton"]', {timeout: 15_000});

            await firstServer!.click('#teamSidebarWrapper [id$="TeamButton"]', {button: 'right'});

            const menuItem = await firstServer!.waitForSelector('.Menu .MenuItem, [role="menuitem"]', {timeout: 5_000});
            expect(menuItem, 'Team context menu must appear on right-click').toBeTruthy();

            await firstServer!.click('#channelHeaderTitle');
        },
    );
});
