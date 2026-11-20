// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {POST_TEXTBOX_SELECTOR, typeIntoPostTextbox, waitForMattermostShellReady} from '../../helpers/mattermostShell';
import {reloadServerView} from '../../helpers/serverContext';
import {apiLogin, apiRequest} from '../../helpers/server_api/client';
import {getTestServerCredentials} from '../../helpers/server_api/credentials';

// 12.0 Cmd+Enter inserts a newline only when Advanced Settings is Off:
// both send_on_ctrl_enter and code_block_ctrl_enter false. Pinning
// send_on_ctrl_enter=false alone is the default radio and still sends.
async function pinCtrlEnterOff(): Promise<void> {
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
            {
                user_id: me.id,
                category: 'advanced_settings',
                name: 'code_block_ctrl_enter',
                value: 'false',
            },
        ]),
    });
}

test.describe('macos_only/cmd_enter', () => {
    test.use({appConfig: demoMattermostConfig});

    test(
        'MM-T2949 CMD+Enter inserts newline on macOS post textbox',
        {tag: ['@P2', '@darwin']},
        async ({serverMap}) => {
            test.skip(!process.env.MM_TEST_SERVER_URL, 'MM_TEST_SERVER_URL required');

            const serverWin = serverMap[demoMattermostConfig.servers[0].name][0].win;
            await pinCtrlEnterOff();
            await loginToMattermost(serverWin);
            await reloadServerView(serverWin.app, serverWin.webContentsId);
            await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_off-topic'});
            await serverWin.click('#sidebarItem_off-topic');
            await serverWin.waitForSelector(POST_TEXTBOX_SELECTOR, {timeout: 15_000});
            await typeIntoPostTextbox(serverWin, 'mac line');
            await serverWin.keyboard.press('Meta+Enter');
            await serverWin.keyboard.type('two');

            const value = await serverWin.evaluate((selector) => {
                const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
                return el?.value ?? (el as HTMLElement | null)?.textContent ?? '';
            }, POST_TEXTBOX_SELECTOR);
            expect(value).toMatch(/mac line[\s\S]*two/);
        },
    );
});
