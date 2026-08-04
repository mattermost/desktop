// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {
    getPostTextboxValue,
    pressPostTextboxKey,
    POST_TEXTBOX_SELECTOR,
    typeIntoPostTextbox,
    waitForChannelPostListLoaded,
    waitForMattermostShell,
} from '../../helpers/mattermostShell';

// ── MM-T2023: ALT+ENTER ───────────────────────────────────────────────
// Alt/Option + Enter inserts a newline in the post textbox without
// submitting the message. This is webapp textbox behaviour (implemented
// in the textbox component via MM-14177, merged in v5.24.0).

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
            await waitForMattermostShell(firstServer!, {channelItem: '#sidebarItem_off-topic'});
            await firstServer!.click('#sidebarItem_off-topic');
            await firstServer!.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 15_000});
            await waitForChannelPostListLoaded(firstServer!);

            const postsBefore = await firstServer!.evaluate(() =>
                document.querySelectorAll('.post-message__text').length,
            );

            await typeIntoPostTextbox(firstServer!, 'Line one');
            await pressPostTextboxKey(firstServer!, 'Alt+Enter');
            await firstServer!.keyboard.type('Line two');

            const textboxValue = await getPostTextboxValue(firstServer!);
            expect(textboxValue, 'Textbox must contain both lines after Alt+Enter').toContain('Line one');
            expect(textboxValue, 'Textbox must contain second line').toContain('Line two');
            expect(textboxValue, 'Textbox must have a newline between lines').toMatch(/Line one\nLine two/);

            const postsAfter = await firstServer!.evaluate(() =>
                document.querySelectorAll('.post-message__text').length,
            );
            expect(postsAfter, 'Alt+Enter must NOT send the message').toBe(postsBefore);

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
                () => firstServer!.evaluate(() =>
                    document.querySelectorAll('.post-message__text').length,
                ),
                {timeout: 10_000, message: 'Send button must post the composed message'},
            ).toBeGreaterThan(postsBefore);

            const lastPostText = await firstServer!.evaluate(() => {
                const posts = document.querySelectorAll('.post-message__text');
                const lastPost = posts[posts.length - 1];
                return lastPost?.textContent ?? '';
            });
            expect(lastPostText, 'Sent message must contain both lines').toContain('Line one');
            expect(lastPostText, 'Sent message must contain second line').toContain('Line two');
        },
    );
});
