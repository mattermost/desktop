// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {cmdOrCtrl} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';

test.describe('copylink', () => {
    test('MM-T125 Copy Link can be used from channel LHS', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.platform === 'linux') {
            test.skip(true, 'Not supported on Linux');
            return;
        }
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const firstServer = serverMap[Object.keys(serverMap)[0]]?.[0]?.win;
        if (!firstServer) {
            test.skip(true, 'No server view available');
            return;
        }

        await loginToMattermost(firstServer);

        // Clear clipboard to prevent pollution from other tests
        await electronApp.evaluate(() => {
            const {clipboard} = require('electron');
            clipboard.writeText('');
        });

        await firstServer.waitForSelector('#sidebarItem_town-square', {timeout: 5000});
        await firstServer.click('#sidebarItem_town-square', {button: 'right'});

        // Use keyboard to navigate context menu based on platform
        if (process.platform === 'win32') {
            await firstServer.keyboard.press('ArrowDown');
            await firstServer.keyboard.press('ArrowDown');
        } else if (process.platform === 'darwin') {
            await firstServer.keyboard.press('c');
        }
        await firstServer.keyboard.press('Enter');

        await firstServer.click('#sidebarItem_town-square');
        await firstServer.click('#post_textbox');

        const clipboardText = await electronApp.evaluate(() => {
            const {clipboard} = require('electron');
            return clipboard.readText();
        });
        expect(clipboardText).toContain('/channels/town-square');
    });
});
