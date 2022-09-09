// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../modules/environment');
const {asyncSleep} = require('../modules/utils');

describe('popup', function desc() {
    this.timeout(40000);

    const config = env.demoMattermostConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    // NOTE: These tests requires that the test server have the GitHub plugin configured
    describe('MM-T2827 Keyboard shortcuts in popup windows', () => {
        let popupWindow;

        beforeEach(async () => {
            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
            const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
            await env.loginToMattermost(firstServer);
            await firstServer.waitForSelector('#sidebarItem_suscipit-4');
            await firstServer.click('#sidebarItem_suscipit-4');
            await firstServer.click('#post_textbox');
            await firstServer.type('#post_textbox', '/github connect');
            await firstServer.press('#post_textbox', 'Enter');

            const githubLink = await firstServer.waitForSelector('a.theme.markdown__link:has-text("GitHub account")');
            githubLink.click();
            popupWindow = await this.app.waitForEvent('window');
            const loginField = await popupWindow.waitForSelector('#login_field');
            await loginField.focus();
            await loginField.type('mattermost');
        });

        it('MM-T2827_1 should be able to select all in popup windows', async () => {
            robot.keyTap('a', [process.platform === 'darwin' ? 'command' : 'control']);
            const selectedText = await popupWindow.evaluate(() => {
                const box = document.querySelectorAll('#login_field')[0];
                return box.value.substring(box.selectionStart,
                    box.selectionEnd);
            });
            selectedText.should.equal('mattermost');
        });

        it('MM-T2827_2 should be able to cut and paste in popup windows', async () => {
            const textbox = await popupWindow.waitForSelector('#login_field');

            await textbox.selectText({force: true});
            robot.keyTap('x', [process.platform === 'darwin' ? 'command' : 'control']);
            let textValue = await textbox.inputValue();
            textValue.should.equal('');

            await textbox.focus();
            robot.keyTap('v', [process.platform === 'darwin' ? 'command' : 'control']);
            textValue = await textbox.inputValue();
            textValue.should.equal('mattermost');
        });

        it('MM-T2827_3 should be able to copy and paste in popup windows', async () => {
            const textbox = await popupWindow.waitForSelector('#login_field');

            await textbox.selectText({force: true});
            robot.keyTap('c', [process.platform === 'darwin' ? 'command' : 'control']);
            await textbox.focus();
            await textbox.type('other-text');
            robot.keyTap('v', [process.platform === 'darwin' ? 'command' : 'control']);
            const textValue = await textbox.inputValue();
            textValue.should.equal('other-textmattermost');
        });
    });

    it('MM-T1659 should not be able to go Back or Forward in the popup window', async () => {
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#sidebarItem_suscipit-4');
        await firstServer.click('#sidebarItem_suscipit-4');
        await firstServer.click('#post_textbox');
        await firstServer.type('#post_textbox', '/github connect');
        await firstServer.press('#post_textbox', 'Enter');

        const githubLink = await firstServer.waitForSelector('a.theme.markdown__link:has-text("GitHub account")');
        githubLink.click();
        const popupWindow = await this.app.waitForEvent('window');
        await popupWindow.bringToFront();
        const currentURL = popupWindow.url();

        // Try and go back
        if (process.platform === 'darwin') {
            robot.keyTap('[', ['command']);
        } else {
            robot.keyTap('left', ['alt']);
        }
        popupWindow.url().should.equal(currentURL);

        // Try and go forward
        if (process.platform === 'darwin') {
            robot.keyTap(']', ['command']);
        } else {
            robot.keyTap('right', ['alt']);
        }
        popupWindow.url().should.equal(currentURL);
    });
});
