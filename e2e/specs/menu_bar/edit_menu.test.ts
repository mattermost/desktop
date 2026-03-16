// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig, cmdOrCtrl} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('edit_menu', () => {
    test('MM-T807 Undo in the Menu Bar', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        await firstServer.click('#post_textbox');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+z`);
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('Mattermos');
    });

    test('MM-T808 Redo in the Menu Bar', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        await firstServer.click('#post_textbox');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+z`);
        const textAfterUndo = await firstServer.inputValue('#post_textbox');
        expect(textAfterUndo).toBe('Mattermos');
        await firstServer.click('#post_textbox');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+Shift+z`);
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('Mattermost');
    });

    test('MM-T809 Cut in the Menu Bar', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+a`);
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+x`);
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('');
    });

    test('MM-T810 Copy in the Menu Bar', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+a`);
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+c`);
        await firstServer.click('#post_textbox');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+v`);
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('MattermostMattermost');
    });

    test('MM-T811 Paste in the Menu Bar', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', 'Mattermost');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+a`);
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+c`);
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+a`);
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+v`);
        const content = await firstServer.inputValue('#post_textbox');
        expect(content).toBe('Mattermost');
    });

    test('MM-T812 Select All in the Menu Bar', {tag: ['@P2', '@all']}, async ({electronApp}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const serverMap = await buildServerMap(electronApp);
        const firstServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
        await loginToMattermost(firstServer);

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.fill('#post_textbox', 'Mattermost');
        await firstServer.keyboard.press(`${cmdOrCtrl === 'command' ? 'Meta' : 'Control'}+a`);
        const channelHeaderText = await firstServer.evaluate('window.getSelection().toString()');
        expect(channelHeaderText).toBe('Mattermost');
    });
});
