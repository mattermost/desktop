// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('mattermost/window_close', () => {
    test(
        'MM-T6146 window.close() in a server view does not crash the app',
        {tag: ['@P1', '@all']},
        async ({electronApp, mainWindow, serverMap}) => {
            const serverName = demoConfig.servers[0].name;
            const serverView = serverMap[serverName]?.[0]?.win;
            expect(serverView).toBeDefined();

            await serverView!.evaluate(() => {
                window.close();
            });

            expect(mainWindow).toBeDefined();
            await expect.poll(
                () => mainWindow.evaluate(() => document.readyState === 'complete'),
                {timeout: 10_000},
            ).toBe(true);

            const refreshedMap = await buildServerMap(electronApp);
            expect(refreshedMap[serverName]?.length ?? 0).toBeGreaterThan(0);
        },
    );

    test(
        'MM-T6147 app can be blurred and refocused after window.close() in a server view',
        {tag: ['@P1', '@all']},
        async ({electronApp, mainWindow, serverMap}) => {
            const serverName = demoConfig.servers[0].name;
            const serverView = serverMap[serverName]?.[0]?.win;
            expect(serverView).toBeDefined();

            await serverView!.evaluate(() => {
                window.close();
            });

            expect(mainWindow).toBeDefined();
            const browserWindow = await electronApp.browserWindow(mainWindow);
            await browserWindow.evaluate((win) => win.blur());
            await browserWindow.evaluate((win) => win.focus());

            await expect.poll(
                () => mainWindow.evaluate(() => document.readyState === 'complete'),
                {timeout: 10_000},
            ).toBe(true);

            const refreshedMap = await buildServerMap(electronApp);
            expect(refreshedMap[serverName]?.length ?? 0).toBeGreaterThan(0);
        },
    );
});
