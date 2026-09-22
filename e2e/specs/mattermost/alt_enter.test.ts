// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {
    getPostTextboxValue,
    pressPostTextboxKey,
    typeIntoPostTextbox,
    waitForChannelPostListLoaded,
    waitForMattermostShellReady,
} from '../../helpers/mattermostShell';
import type {ServerView} from '../../helpers/serverView';

// ── MM-T2023: ALT+ENTER ───────────────────────────────────────────────
// Alt/Option + Enter inserts a newline in the post textbox without
// submitting the message. This is webapp textbox behaviour (implemented
// in the textbox component via MM-14177, merged in v5.24.0).

async function postListContainsLines(win: ServerView, lineOne: string, lineTwo: string): Promise<boolean> {
    return win.evaluate(({one, two}) => {
        return Array.from(document.querySelectorAll('.post-message__text')).some((el) => {
            const text = el.textContent ?? '';
            return text.includes(one) && text.includes(two);
        });
    }, {one: lineOne, two: lineTwo});
}

test.describe('mattermost/alt_enter', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T2023 ALT+ENTER inserts a newline without sending the message',
        {tag: ['@P2', '@all']},
        async ({serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const firstServer = serverMap[demoMattermostConfig.servers[0].name]?.[0]?.win;
            expect(firstServer, 'Server view must exist').toBeTruthy();

            await loginToMattermost(firstServer!);
            await waitForMattermostShellReady(firstServer!, {channelItem: '#sidebarItem_off-topic'});
            await firstServer!.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(firstServer!);

            // Do not snapshot .post-message__text length here. waitForChannelPostListLoaded
            // is header+composer (12.0 PostList keeps a sentinel .loading-screen), so the
            // virt list may still be empty. CI macos then painted 15 history posts and the
            // count equality looked like Alt+Enter sent the draft.
            const lineOne = `Line one ${Date.now()}`;
            const lineTwo = 'Line two';

            await typeIntoPostTextbox(firstServer!, lineOne);
            await pressPostTextboxKey(firstServer!, 'Alt+Enter');
            await firstServer!.keyboard.type(lineTwo);

            const textboxValue = await getPostTextboxValue(firstServer!);
            expect(textboxValue, 'Textbox must contain both lines after Alt+Enter').toContain(lineOne);
            expect(textboxValue, 'Textbox must contain second line').toContain(lineTwo);
            expect(
                textboxValue.replace(/\r\n/g, '\n'),
                'Textbox must have a newline between lines',
            ).toContain(`${lineOne}\n${lineTwo}`);

            expect(
                await postListContainsLines(firstServer!, lineOne, lineTwo),
                'Alt+Enter must NOT send the message',
            ).toBe(false);

            const sendButtonClicked = await firstServer!.evaluate(() => {
                const sendButton = document.querySelector(
                    '#channelHeaderSubmitButton, button[aria-label*="Send" i], [data-testid="SendMessageButton"]',
                ) as HTMLButtonElement | null;
                if (!sendButton) {
                    return false;
                }
                sendButton.click();
                return true;
            });
            expect(sendButtonClicked, 'Send button must be present before posting').toBe(true);

            await expect.poll(
                () => postListContainsLines(firstServer!, lineOne, lineTwo),
                {timeout: 10_000, message: 'Send button must post the composed message'},
            ).toBe(true);
        },
    );
});
