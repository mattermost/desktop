// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForChannelPostListLoaded} from '../../helpers/channelReadiness';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {
    activateServerView,
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
            await expectServerViewUrl(electronApp, entry.webContentsId, /mattermost|8065/i);
            await loginToMattermost(entry.win);
            await activateServerView(electronApp, entry.webContentsId);
            await waitForChannelPostListLoaded(entry.win);

            if (process.platform === 'darwin') {
                await entry.win.keyboard.press('Meta+f');
            } else {
                await openServerSearch(electronApp, entry.webContentsId);
            }

            await waitForSearchBarFocused(entry.win);
            await entry.win.fill(SEARCH_INPUT, 'hello');
            await entry.win.click(SEARCH_INPUT);
            await entry.win.keyboard.press('ArrowLeft');
            await entry.win.keyboard.press('ArrowLeft');
            await entry.win.keyboard.press('Backspace');

            expect(await entry.win.inputValue(SEARCH_INPUT)).toBe('helo');
        },
    );
});
