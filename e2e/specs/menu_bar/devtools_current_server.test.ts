// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {waitForChannelPostListLoaded} from '../../helpers/channelReadiness';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {clickApplicationMenuItem} from '../../helpers/menu';
import {activateServerEntry, getServerEntry} from '../../helpers/serverContext';
import {getActiveServerWebContentsId} from '../../helpers/testRefs';

test.describe('menu_bar/devtools_current_server', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test('MM-T821 Toggle Developer Tools for Current Server in the Menu Bar',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const entry = getServerEntry(serverMap, demoMattermostConfig.servers[0].name);
            await activateServerEntry(electronApp, entry);
            await loginToMattermost(entry.win);
            await entry.win.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
            await waitForChannelPostListLoaded(entry.win);

            const webContentsId = entry.webContentsId ?? await getActiveServerWebContentsId(electronApp);

            await expect.poll(async () => {
                return electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return Boolean(wc && !wc.isDestroyed());
                }, webContentsId);
            }, {timeout: 10_000, message: 'Server webContents should exist'}).toBe(true);

            await clickApplicationMenuItem(
                electronApp,
                'view',
                {label: 'Developer Tools for Current Tab'},
                {webContentsId},
            );
            await expect.poll(
                () => electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return Boolean(wc && !wc.isDestroyed() && wc.isDevToolsOpened());
                }, webContentsId),
                {timeout: 15_000, message: 'DevTools must open for the current server webContents after menu click'},
            ).toBe(true);

            await electronApp.evaluate(({webContents}, id) => {
                const wc = webContents.fromId(id);
                if (wc && !wc.isDestroyed() && wc.isDevToolsOpened()) {
                    wc.toggleDevTools();
                }
            }, webContentsId).catch(() => {});

            await expect.poll(
                () => electronApp.evaluate(({webContents}, id) => {
                    const wc = webContents.fromId(id);
                    return wc && !wc.isDestroyed() ? !wc.isDevToolsOpened() : true;
                }, webContentsId).catch(() => true),
                {timeout: 15_000, message: 'DevTools must close after toggle'},
            ).toBe(true);

            await expect.poll(async () => {
                try {
                    return await entry.win.evaluate(() => document.querySelector('#post_textbox') !== null);
                } catch {
                    return false;
                }
            }, {
                timeout: 15_000,
                message: 'Server view should still be functional after DevTools toggle',
            }).toBe(true);
        },
    );
});
