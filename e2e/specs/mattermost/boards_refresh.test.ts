// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig, mattermostURL} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {waitForMattermostShellReady} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {expectServerViewUrl, getServerViewUrl, loadServerViewUrl, reloadServerView} from '../../helpers/serverContext';

test.describe('mattermost/boards_refresh', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(180_000);

    test(
        'MM-T4416 Refreshing a board should reopen the same board',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            expect(serverEntry?.win, 'Mattermost server view should exist').toBeTruthy();
            const serverWin = serverEntry!.win;
            const webContentsId = serverEntry!.webContentsId;

            await prepareMattermostServerView(electronApp, webContentsId);
            await loginToMattermost(serverWin);
            await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_town-square'});

            const hasBoards = await electronApp.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const serverId = refs?.ServerManager?.getCurrentServerId?.();
                return Boolean(serverId && refs?.ServerManager?.getRemoteInfo?.(serverId)?.hasFocalboard);
            });
            if (!hasBoards) {
                test.skip(true, 'Boards plugin is not available on this test server');
                return;
            }

            const boardsUrl = `${new URL(mattermostURL).origin}/boards`;
            await loadServerViewUrl(electronApp, webContentsId, boardsUrl);

            await expect.poll(
                () => getServerViewUrl(electronApp, webContentsId),
                {timeout: 30_000, message: 'Server view must navigate to Boards'},
            ).toMatch(/\/boards/i);

            const boardUrlBeforeReload = await getServerViewUrl(electronApp, webContentsId);
            expect(boardUrlBeforeReload).toMatch(/\/boards/i);

            await reloadServerView(electronApp, webContentsId);

            await expectServerViewUrl(
                electronApp,
                webContentsId,
                /\/boards/i,
                {timeout: 60_000, message: 'Reload must restore the same Boards route'},
            );

            const boardUrlAfterReload = await getServerViewUrl(electronApp, webContentsId);
            expect(boardUrlAfterReload).toBe(boardUrlBeforeReload);
        },
    );
});
