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
    let popupWindow;
    let firstServer;

    before(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);

        await firstServer.click('#post_textbox');
        await firstServer.fill('#post_textbox', '');
        await firstServer.type('#post_textbox', '/github connect ');
        await firstServer.click('button[data-testid="SendMessageButton"]');

        const githubLink = await firstServer.waitForSelector('a.theme.markdown__link:has-text("GitHub account")');
        githubLink.click();
        popupWindow = await this.app.waitForEvent('window');

        const loginField = await popupWindow.waitForSelector('#login_field');
        await loginField.focus();
        robot.typeString('Mattermost');
        await asyncSleep(3000);
    });

    after(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    // NOTE: These tests requires that the test server have the GitHub plugin configured
    it('MM-T2827_1 should be able to select all in popup windows', async () => {
        robot.keyTap('a', env.cmdOrCtrl);
        await asyncSleep(1000);

        const selectedText = await popupWindow.evaluate(() => {
            const box = document.querySelectorAll('#login_field')[0];
            return box.value.substring(box.selectionStart,
                box.selectionEnd);
        });
        await asyncSleep(3000);
        selectedText.should.equal('Mattermost');
    });

    it('MM-T2827_2 should be able to cut and paste in popup windows', async () => {
        await asyncSleep(1000);
        const textbox = await popupWindow.waitForSelector('#login_field');

        await textbox.selectText({force: true});
        robot.keyTap('x', env.cmdOrCtrl);
        let textValue = await textbox.inputValue();
        textValue.should.equal('');

        await textbox.focus();
        robot.keyTap('v', env.cmdOrCtrl);
        textValue = await textbox.inputValue();
        textValue.should.equal('Mattermost');
    });

    it('MM-T2827_3 should be able to copy and paste in popup windows', async () => {
        await asyncSleep(1000);
        const textbox = await popupWindow.waitForSelector('#login_field');

        await textbox.selectText({force: true});
        robot.keyTap('c', env.cmdOrCtrl);
        await textbox.focus();
        await textbox.type('other-text');
        robot.keyTap('v', env.cmdOrCtrl);
        const textValue = await textbox.inputValue();
        textValue.should.equal('other-textMattermost');
    });

    it('MM-T1659 should not be able to go Back or Forward in the popup window', async () => {
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
