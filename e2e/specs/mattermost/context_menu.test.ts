// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {openSidebarChannelMenu, openTeamSidebarContextMenu, listenForNativeContextMenu, waitForNativeContextMenu} from '../../helpers/channelMenu';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import type {ServerEntry} from '../../helpers/serverMap';
import {ensureMultipleTeams} from '../../helpers/team';
import type {ServerView} from '../../helpers/serverView';

// ── MM-T1307: Right-click a channel name / team name in LHS ────────────
// Channel "Copy Link" lives in the webapp's sidebar channel-options menu,
// Channel menus use webapp .Menu components; team sidebar uses Chromium's
// native context menu since MM-57962 removed the webapp Copy Link menu.

test.describe('mattermost/context_menu', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test.beforeAll(() => {
        test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');
    });

    let serverEntry: ServerEntry | undefined;
    let firstServer: ServerView | undefined;
    let cleanupCreatedTeam: (() => Promise<void>) | undefined;

    test.afterAll(async () => {
        await cleanupCreatedTeam?.();
    });

    // serverMap is test-scoped; Playwright forbids it in beforeAll, so shared
    // login runs in beforeEach (cheap once the session cookie is established).
    test.beforeEach(async ({electronApp, serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            return;
        }

        serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
        firstServer = serverEntry?.win;
        expect(firstServer, 'Server view must exist').toBeTruthy();

        await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
        await loginToMattermost(firstServer!);
        await firstServer!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
    });

    test('MM-T1307 Right-click a channel name in LHS shows context menu',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            expect(serverEntry, 'Shared server entry must be initialized in beforeEach').toBeTruthy();
            expect(firstServer, 'Shared server view must be initialized in beforeEach').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await openSidebarChannelMenu(firstServer!, '#sidebarItem_town-square');

            const hasCopyLink = await firstServer!.evaluate(() => {
                const items = document.querySelectorAll('.Menu .MenuItem, [role="menuitem"]');
                return Array.from(items).some(
                    (item) => (/^copy link$/i).test((item.textContent ?? '').trim()),
                );
            });
            expect(hasCopyLink, '"Copy Link" must appear in channel context menu').toBe(true);

            await firstServer!.click('#channelHeaderTitle');
        },
    );

    test('MM-T1307_2 Right-click a team name in LHS shows context menu',
        {tag: ['@P2', '@all']},
        async ({electronApp}) => {
            expect(serverEntry, 'Shared server entry must be initialized in beforeEach').toBeTruthy();
            expect(firstServer, 'Shared server view must be initialized in beforeEach').toBeTruthy();

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            const {cleanup} = await ensureMultipleTeams(electronApp, firstServer!, serverEntry!.webContentsId);
            cleanupCreatedTeam = cleanup;
            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await firstServer!.waitForSelector('#teamSidebarWrapper, button[aria-label$=" team"]', {timeout: 15_000});

            await listenForNativeContextMenu(electronApp, serverEntry!.webContentsId);
            await openTeamSidebarContextMenu(firstServer!, electronApp, serverEntry!.webContentsId);
            await waitForNativeContextMenu(electronApp);

            await firstServer!.click('#channelHeaderTitle');
        },
    );
});
