// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {closeDownloadsDropdownIfOpen} from '../../helpers/downloadsDropdown';
import {loginToMattermost} from '../../helpers/login';
import {waitForMattermostShell} from '../../helpers/mattermostShell';
import {
    activateServerEntry,
    expectServerViewUrl,
    getServerEntry,
    openServerSearch,
    SEARCH_INPUT,
    waitForSearchBarFocused,
} from '../../helpers/serverContext';

test.describe('search_box/search_box', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T1309 Type some text in the search box',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
            await activateServerEntry(electronApp, entry);
            await expectServerViewUrl(electronApp, entry.webContentsId, /mattermost|8065/i);
            const serverWin = entry.win;
            await loginToMattermost(serverWin);
            await waitForMattermostShell(serverWin);
            await closeDownloadsDropdownIfOpen(electronApp);
            await activateServerEntry(electronApp, entry);

            if (process.platform === 'darwin') {
                await serverWin.keyboard.press('Meta+f');
            } else {
                await openServerSearch(electronApp, entry.webContentsId);
            }

            await waitForSearchBarFocused(serverWin);
            await serverWin.fill(SEARCH_INPUT, 'hello');
            await serverWin.click(SEARCH_INPUT);
            await serverWin.keyboard.press('ArrowLeft');
            await serverWin.keyboard.press('ArrowLeft');
            await serverWin.keyboard.press('Backspace');

            expect(await serverWin.inputValue(SEARCH_INPUT)).toBe('helo');
        },
    );
});
