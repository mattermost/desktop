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
import {apiLogin, apiRequest} from '../../helpers/server_api/client';
import {getTestServerCredentials} from '../../helpers/server_api/credentials';
import type {ServerView} from '../../helpers/serverView';

async function disableSendOnCtrlEnter(): Promise<void> {
    const {baseUrl, username, password} = getTestServerCredentials();
    const token = await apiLogin(baseUrl, username, password);
    const me = await apiRequest<{id: string}>(baseUrl, token, '/api/v4/users/me');
    await apiRequest<unknown>(baseUrl, token, '/api/v4/users/me/preferences', {
        method: 'PUT',
        body: JSON.stringify([
            {
                user_id: me.id,
                category: 'advanced_settings',
                name: 'send_on_ctrl_enter',
                value: 'false',
            },
        ]),
    });
}

async function postListContains(win: ServerView, text: string): Promise<boolean> {
    return win.evaluate((needle) => {
        return Array.from(document.querySelectorAll('.post-message__text')).some((el) => {
            return (el.textContent ?? '').includes(needle);
        });
    }, text);
}

test.describe('macos_only/cmd_enter', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T2949 CMD+Enter inserts newline on macOS post textbox',
        {tag: ['@P2', '@darwin']},
        async ({serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverWin = serverMap[demoMattermostConfig.servers[0].name][0].win;
            await disableSendOnCtrlEnter();
            await loginToMattermost(serverWin);
            await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_off-topic'});
            await serverWin.click('#sidebarItem_off-topic');
            await waitForChannelPostListLoaded(serverWin);

            // Unique first line so a premature send cannot hide behind a leftover
            // "mac line" post. 4012 macos 248418b1: composer was "two" and Off-Topic
            // contained a sent "mac line" — Cmd+Enter submitted, not a lost draft.
            const lineOne = `mac line ${Date.now()}`;
            const lineTwo = 'two';

            await typeIntoPostTextbox(serverWin, lineOne);
            expect(
                await getPostTextboxValue(serverWin),
                'Composer must hold the first line before Cmd+Enter',
            ).toContain(lineOne);

            await pressPostTextboxKey(serverWin, 'Meta+Enter');
            await serverWin.keyboard.type(lineTwo);

            const textboxValue = await getPostTextboxValue(serverWin);
            expect(textboxValue, 'Textbox must contain both lines after Cmd+Enter').toContain(lineOne);
            expect(textboxValue, 'Textbox must contain second line').toContain(lineTwo);
            expect(
                textboxValue.replace(/\r\n/g, '\n'),
                'Textbox must have a newline between lines',
            ).toContain(`${lineOne}\n${lineTwo}`);
            expect(
                await postListContains(serverWin, lineOne),
                'Cmd+Enter must NOT send the message',
            ).toBe(false);
        },
    );
});
