// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const fs = require('fs');

const {expect} = require('chai');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

describe('Trigger Notification From desktop', function desc() {
    this.timeout(400000);

    const config = env.demoMattermostConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);

        loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        const textbox = await firstServer.waitForSelector('#post_textbox');
        textbox.focus();
    });

    env.shouldTest(it, process.platform === 'darwin')('should receive a notification on macOS', async () => {
        await triggerTestNotification();
        const badgeValue = await this.app.evaluate(async ({app}) => {
            return app.dock.getBadge();
        });
        badgeValue.should.equal('1');
        await verifyNotificationRecievedinDM();
    });
    env.shouldTest(it, process.platform === 'win32')('should receive a notification on Windows', async () => {
        await triggerTestNotification();
        const badgeValue = await this.app.evaluate(async ({app}) => {
            return app.dock.getBadge();
        });
        badgeValue.should.equal('1');
        await verifyNotificationRecievedinDM();

    });
    env.shouldTest(it, process.platform === 'linux')('should receive a notification on Ubuntu', async () => {
        await triggerTestNotification();
        const badgeValue = await this.app.evaluate(async ({app}) => {
            return app.dock.getBadge();
        });
        badgeValue.should.equal('1');
        await verifyNotificationRecievedinDM();
    });
});

async function triggerTestNotification() {
    await firstServer.click('div#CustomizeYourExperienceTour > button');
    const sendNotificationButton = await firstServer.waitForSelector('.sectionNoticeButton.btn-primary');
    await sendNotificationButton.scrollIntoViewIfNeeded();
    const textBeforeClick = await sendNotificationButton.textContent();
    textBeforeClick.should.equal('Send a test notification');
    await sendNotificationButton.click();
    await asyncSleep(2000);
    const textAfterClick = await sendNotificationButton.textContent();
    textAfterClick.should.equal('Error sending test notification');
}

async function verifyNotificationRecievedinDM() {
    await firstServer.click('#accountSettingsHeader > button.close');
    const sidebarLink = await firstServer.locator('a.SidebarLink:has-text("system-bot")');
    const badgeElement = await sidebarLink.locator('span.badge');
    const badgeCount = await badgeElement.textContent();
    badgeCount.should.equal('1');

    sidebarLink.click()
    await asyncSleep(1000);

    const lastPostBody = await firstServer.locator('div.post__body').last();
    const textContent = await lastPostBody.textContent();
    textContent.should.equal("If you received this test notification, it worked!");
}