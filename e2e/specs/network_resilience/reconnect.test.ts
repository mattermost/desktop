// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

test.use({appConfig: demoMattermostConfig});

test(
    'app does not crash when server becomes unreachable and recovers',
    {tag: ['@P0', '@all']},
    async ({electronApp, serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required for network resilience test');
            return;
        }

        const serverEntry = serverMap.example?.[0];
        const serverWin = serverEntry?.win;
        if (!serverWin || !serverEntry) {
            test.skip(true, 'No server view available');
            return;
        }

        await loginToMattermost(serverWin);
        await serverWin.waitForSelector('#post_textbox');

        const baseUrl = new URL(process.env.MM_TEST_SERVER_URL!).origin;
        const webContentsId = serverEntry.webContentsId;

        await electronApp.evaluate(({session}, payload) => {
            (global as any).__e2eReconnectBlock = payload;
            session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
                const state = (global as any).__e2eReconnectBlock;
                if (
                    state?.enabled &&
                    details.webContentsId === state.webContentsId &&
                    details.url.startsWith(state.baseUrl)
                ) {
                    callback({cancel: true});
                    return;
                }
                callback({});
            });
        }, {enabled: true, baseUrl, webContentsId});

        await electronApp.evaluate(({webContents}, id) => {
            webContents.fromId(id)?.reload();
        }, webContentsId);

        // App windows should still exist after network failures.
        expect(electronApp.windows().length).toBeGreaterThan(0);

        // Restore network access and remove the handler
        await electronApp.evaluate(({webContents, session}, id) => {
            const state = (global as any).__e2eReconnectBlock;
            if (state) {
                state.enabled = false;
            }
            session.defaultSession.webRequest.onBeforeRequest(null as any);
            delete (global as any).__e2eReconnectBlock;
            webContents.fromId(id)?.reload();
        }, webContentsId);

        // The view should attempt to reconnect (URL still points to server)
        await expect.poll(
            () => serverWin.url(),
            {timeout: 10_000, message: 'URL should contain server host after restore'},
        ).toContain(new URL(process.env.MM_TEST_SERVER_URL!).host);
    },
);
