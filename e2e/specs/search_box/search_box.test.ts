// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {clickApplicationMenuItem} from '../../helpers/menu';
import {waitForMattermostShell} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';

test.describe('search_box/search_box', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T1309 Type some text in the search box',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name][0];
            await prepareMattermostServerView(electronApp, serverEntry.webContentsId);
            const serverWin = serverEntry.win;
            await loginToMattermost(serverWin);
            await waitForMattermostShell(serverWin);

            await clickApplicationMenuItem(
                electronApp,
                'view',
                {accelerator: process.platform === 'darwin' ? 'Cmd+F' : 'Ctrl+F'},
                {webContentsId: serverEntry.webContentsId},
            );

            await serverWin.waitForSelector('#searchBox', {timeout: 15_000});
            await serverWin.fill('#searchBox', 'hello');
            await serverWin.click('#searchBox');
            await serverWin.keyboard.press('ArrowLeft');
            await serverWin.keyboard.press('ArrowLeft');
            await serverWin.keyboard.press('Backspace');

            expect(await serverWin.inputValue('#searchBox')).toBe('helo');
        },
    );
});
