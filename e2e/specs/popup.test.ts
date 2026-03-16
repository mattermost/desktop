// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../fixtures/index';
import {cmdOrCtrl} from '../helpers/config';
import {loginToMattermost} from '../helpers/login';

// The new servers created for running e2e will not have github plugin configured
// Skip in CI but allow running locally

test.describe('popup', () => {
    test('MM-T2827_1 should be able to select all in popup windows', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.env.CI) {
            test.skip(true, 'Skipped in CI');
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

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', '/github connect ');
        await firstServer.click('button[data-testid="SendMessageButton"]');

        const githubLink = await firstServer.waitForSelector('a.theme.markdown__link:has-text("GitHub account")');
        await githubLink.click();
        const popupWindow = await electronApp.waitForEvent('window');

        const loginField = await popupWindow.waitForSelector('#login_field');
        await loginField.focus();
        await popupWindow.keyboard.type('Mattermost');

        const selectAllKey = cmdOrCtrl === 'command' ? 'Meta+a' : 'Control+a';
        await popupWindow.keyboard.press(selectAllKey);

        const selectedText = await popupWindow.evaluate(() => {
            const box = document.querySelectorAll('#login_field')[0] as HTMLInputElement;
            return box.value.substring(box.selectionStart!, box.selectionEnd!);
        });
        expect(selectedText).toBe('Mattermost');
    });

    test('MM-T2827_2 should be able to cut and paste in popup windows', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.env.CI) {
            test.skip(true, 'Skipped in CI');
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

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', '/github connect ');
        await firstServer.click('button[data-testid="SendMessageButton"]');

        const githubLink = await firstServer.waitForSelector('a.theme.markdown__link:has-text("GitHub account")');
        await githubLink.click();
        const popupWindow = await electronApp.waitForEvent('window');

        const loginField = await popupWindow.waitForSelector('#login_field');
        await loginField.focus();
        await popupWindow.keyboard.type('Mattermost');

        const textbox = await popupWindow.waitForSelector('#login_field');
        await textbox.selectText({force: true});
        const cutKey = cmdOrCtrl === 'command' ? 'Meta+x' : 'Control+x';
        await popupWindow.keyboard.press(cutKey);
        let textValue = await textbox.inputValue();
        expect(textValue).toBe('');

        await textbox.focus();
        const pasteKey = cmdOrCtrl === 'command' ? 'Meta+v' : 'Control+v';
        await popupWindow.keyboard.press(pasteKey);
        textValue = await textbox.inputValue();
        expect(textValue).toBe('Mattermost');
    });

    test('MM-T2827_3 should be able to copy and paste in popup windows', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.env.CI) {
            test.skip(true, 'Skipped in CI');
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

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', '/github connect ');
        await firstServer.click('button[data-testid="SendMessageButton"]');

        const githubLink = await firstServer.waitForSelector('a.theme.markdown__link:has-text("GitHub account")');
        await githubLink.click();
        const popupWindow = await electronApp.waitForEvent('window');

        const loginField = await popupWindow.waitForSelector('#login_field');
        await loginField.focus();
        await popupWindow.keyboard.type('Mattermost');

        const textbox = await popupWindow.waitForSelector('#login_field');
        await textbox.selectText({force: true});
        const copyKey = cmdOrCtrl === 'command' ? 'Meta+c' : 'Control+c';
        await popupWindow.keyboard.press(copyKey);
        await textbox.focus();
        await textbox.type('other-text');
        const pasteKey = cmdOrCtrl === 'command' ? 'Meta+v' : 'Control+v';
        await popupWindow.keyboard.press(pasteKey);
        const textValue = await textbox.inputValue();
        expect(textValue).toBe('other-textMattermost');
    });

    test('MM-T1659 should not be able to go Back or Forward in the popup window', {tag: ['@P2', '@all']}, async ({electronApp, serverMap}) => {
        if (process.env.CI) {
            test.skip(true, 'Skipped in CI');
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

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', '/github connect ');
        await firstServer.click('button[data-testid="SendMessageButton"]');

        const githubLink = await firstServer.waitForSelector('a.theme.markdown__link:has-text("GitHub account")');
        await githubLink.click();
        const popupWindow = await electronApp.waitForEvent('window');
        await popupWindow.waitForSelector('#login_field');

        const currentURL = popupWindow.url();

        // Try and go back
        if (process.platform === 'darwin') {
            await popupWindow.keyboard.press('Meta+[');
        } else {
            await popupWindow.keyboard.press('Alt+ArrowLeft');
        }
        expect(popupWindow.url()).toBe(currentURL);

        // Try and go forward
        if (process.platform === 'darwin') {
            await popupWindow.keyboard.press('Meta+]');
        } else {
            await popupWindow.keyboard.press('Alt+ArrowRight');
        }
        expect(popupWindow.url()).toBe(currentURL);
    });
});
