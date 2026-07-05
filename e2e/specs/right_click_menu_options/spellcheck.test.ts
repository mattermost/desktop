// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {
    POST_TEXTBOX_SELECTOR,
    applySpellcheckSuggestion,
    getPostTextboxWordPoint,
    listenForNativeContextMenu,
    rightClickAtPoint,
    typeIntoPostTextbox,
    waitForNativeContextMenu,
    waitForMattermostShell,
} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';

const MISSPELLED_WORD = 'helo';
const EXPECTED_SUGGESTION = 'hello';

test.describe('right_click_menu_options/spellcheck', () => {
    test.use({appConfig: {...demoMattermostConfig, useSpellChecker: true}});
    test.setTimeout(120_000);

    test(
        'MM-T829 Desktop App shows spell check options when you right click',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name][0];
            const serverWin = serverEntry.win;
            await prepareMattermostServerView(electronApp, serverEntry.webContentsId);
            await loginToMattermost(serverWin);
            await waitForMattermostShell(serverWin);
            await serverWin.click('#sidebarItem_off-topic');
            await serverWin.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 15_000});

            await typeIntoPostTextbox(serverWin, MISSPELLED_WORD);
            const point = await getPostTextboxWordPoint(serverWin, MISSPELLED_WORD);
            if (!point) {
                test.skip(true, 'Could not locate misspelled word in post textbox');
                return;
            }

            await listenForNativeContextMenu(electronApp, serverEntry.webContentsId);
            await rightClickAtPoint(electronApp, serverEntry.webContentsId, point);
            const menuParams = await waitForNativeContextMenu(electronApp);

            expect(menuParams.misspelledWord).toBe(MISSPELLED_WORD);
            const suggestions = menuParams.dictionarySuggestions as string[] | undefined;
            expect(Array.isArray(suggestions)).toBe(true);
            expect(suggestions!.length).toBeGreaterThan(0);
        },
    );

    test(
        'MM-T1320 Use spell-check suggestion',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name][0];
            const serverWin = serverEntry.win;
            await prepareMattermostServerView(electronApp, serverEntry.webContentsId);
            await loginToMattermost(serverWin);
            await waitForMattermostShell(serverWin);
            await serverWin.click('#sidebarItem_off-topic');
            await serverWin.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 15_000});

            await typeIntoPostTextbox(serverWin, MISSPELLED_WORD);
            const point = await getPostTextboxWordPoint(serverWin, MISSPELLED_WORD);
            if (!point) {
                test.skip(true, 'Could not locate misspelled word in post textbox');
                return;
            }

            await listenForNativeContextMenu(electronApp, serverEntry.webContentsId);
            await rightClickAtPoint(electronApp, serverEntry.webContentsId, point);
            const menuParams = await waitForNativeContextMenu(electronApp);
            const suggestions = menuParams.dictionarySuggestions as string[] | undefined;
            if (!suggestions?.length) {
                test.skip(true, 'No spell-check suggestions returned by the OS spellchecker');
                return;
            }

            const suggestion = suggestions.find((item) => item.toLowerCase() === EXPECTED_SUGGESTION) ?? suggestions[0];
            await applySpellcheckSuggestion(electronApp, serverEntry.webContentsId, suggestion);

            const value = await serverWin.evaluate((selector) => {
                const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLElement | null;
                if (!el) {
                    return '';
                }
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    return el.value;
                }
                return el.textContent ?? el.innerText ?? '';
            }, POST_TEXTBOX_SELECTOR) as string;
            expect(value.toLowerCase()).toContain(suggestion.toLowerCase());
        },
    );
});
