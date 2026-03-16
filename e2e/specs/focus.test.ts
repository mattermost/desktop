// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../fixtures/index';

const SHOW_SETTINGS_WINDOW = 'show-settings-window';
import {demoMattermostConfig} from '../helpers/config';
import {loginToMattermost} from '../helpers/login';

const config = {
    ...demoMattermostConfig,
    servers: [
        ...demoMattermostConfig.servers,
        {
            name: 'community',
            url: 'https://community.mattermost.com',
            order: 0,
        },
    ],
};

test.describe('focus', () => {
    test.describe('Focus textbox tests', () => {
        test('MM-T1315 should return focus to the message box when closing the settings modal', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const firstServer = serverMap[config.servers[0].name]?.[0]?.win;
            if (!firstServer) {
                test.skip(true, 'No server view available');
                return;
            }

            await loginToMattermost(firstServer);
            const textbox = await firstServer.waitForSelector('#post_textbox');
            await textbox.focus();

            await electronApp.evaluate(({ipcMain}, showWindow) => {
                ipcMain.emit(showWindow);
            }, SHOW_SETTINGS_WINDOW);
            const settingsWindow = await electronApp.waitForEvent('window', {
                predicate: (window) => window.url().includes('settings'),
            });
            await settingsWindow.waitForSelector('.SettingsModal');
            await settingsWindow.close();

            // Wait for focus to return to textbox after modal close
            await firstServer.waitForFunction(
                () => document.activeElement?.id === 'post_textbox',
                {timeout: 3000},
            );

            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            expect(isTextboxFocused).toBe(true);

            await firstServer.fill('#post_textbox', '');

            // Make sure you can just start typing and it'll go in the post textbox
            await firstServer.fill('#post_textbox', 'Mattermost');

            const textboxString = await firstServer.inputValue('#post_textbox');
            expect(textboxString).toBe('Mattermost');
        });

        test('MM-T1316 should return focus to the message box when closing the Add Server modal', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const firstServer = serverMap[config.servers[0].name]?.[0]?.win;
            if (!firstServer) {
                test.skip(true, 'No server view available');
                return;
            }

            await loginToMattermost(firstServer);
            const textbox = await firstServer.waitForSelector('#post_textbox');
            await textbox.focus();

            const mainView = electronApp.windows().find((window) => window.url().includes('index'));
            const dropdownView = electronApp.windows().find((window) => window.url().includes('dropdown'));
            if (!mainView || !dropdownView) {
                throw new Error('Required views not found');
            }
            await mainView.click('.ServerDropdownButton');
            await dropdownView.click('.ServerDropdown .ServerDropdown__button.addServer');
            const newServerView = await electronApp.waitForEvent('window', {
                predicate: (window) => window.url().includes('newServer'),
            });
            await newServerView.waitForSelector('#newServerModal_cancel');
            await newServerView.click('#newServerModal_cancel');

            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            expect(isTextboxFocused).toBe(true);

            await firstServer.fill('#post_textbox', '');

            // Make sure you can just start typing and it'll go in the post textbox
            await firstServer.fill('#post_textbox', 'Mattermost');

            const textboxString = await firstServer.inputValue('#post_textbox');
            expect(textboxString).toBe('Mattermost');
        });

        test('MM-T1317 should return focus to the focused box when switching servers', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const firstServer = serverMap[config.servers[0].name]?.[0]?.win;
            if (!firstServer) {
                test.skip(true, 'No server view available');
                return;
            }

            await loginToMattermost(firstServer);
            const textbox = await firstServer.waitForSelector('#post_textbox');
            await textbox.focus();

            const mainView = electronApp.windows().find((window) => window.url().includes('index'));
            const dropdownView = electronApp.windows().find((window) => window.url().includes('dropdown'));
            if (!mainView || !dropdownView) {
                throw new Error('Required views not found');
            }
            await mainView.click('.ServerDropdownButton');
            await dropdownView.click('.ServerDropdown .ServerDropdown__button:has-text("community")');
            const secondServer = serverMap.community?.[0]?.win;
            if (!secondServer) {
                throw new Error('community server view not found');
            }
            await secondServer.waitForSelector('#input_loginId');
            await secondServer.focus('#input_loginId');

            await mainView.click('.ServerDropdownButton');
            await dropdownView.click(`.ServerDropdown .ServerDropdown__button:has-text("${config.servers[0].name}")`);
            const isTextboxFocused = await firstServer.$eval('#post_textbox', (el) => el === document.activeElement);
            expect(isTextboxFocused).toBe(true);

            await firstServer.fill('#post_textbox', '');

            // Make sure you can just start typing and it'll go in the post textbox
            await firstServer.fill('#post_textbox', 'Mattermost');

            const textboxString = await firstServer.inputValue('#post_textbox');
            expect(textboxString).toBe('Mattermost');

            await mainView.click('.ServerDropdownButton');
            await dropdownView.click('.ServerDropdown .ServerDropdown__button:has-text("community")');
            const isLoginFocused = await secondServer.$eval('#input_loginId', (el) => el === document.activeElement);
            expect(isLoginFocused).toBe(true);

            // Make sure you can just start typing and it'll go in the login field
            await secondServer.keyboard.type('username');

            const loginString = await secondServer.inputValue('#input_loginId');
            expect(loginString).toBe('username');
        });
    });
});
