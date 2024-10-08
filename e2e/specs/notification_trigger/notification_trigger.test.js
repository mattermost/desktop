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
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const browserWindow = await this.app.browserWindow(mainWindow);

        const permissionStatus = await browserWindow.evaluate(() => Notification.permission);
        expect(permissionStatus).toBe('granted');

        await firstServer.click('div#CustomizeYourExperienceTour > button');

        const sendNotificationButton = await firstServer.waitForSelector('.btn-primary');
        await sendNotificationButton.scrollIntoViewIfNeeded();
        await sendNotificationButton.click();

        await asyncSleep(100000);

        const notification = await getNotification();

        // Verify the notification content
        expect(notification).toBeTruthy();
        expect(notification.title).toBe('Expected Notification Title');
        expect(notification.body).toContain('Expected notification content');
    });

    env.shouldTest(it, process.platform === 'win32')('should receive a notification on Windows', async () => {
        await firstServer.click('div#CustomizeYourExperienceTour > button');
        const sendNotificationButton = await firstServer.waitForSelector('.btn-primary');
        await sendNotificationButton.scrollIntoViewIfNeeded();
        await sendNotificationButton.click();
        await asyncSleep(100000);

        const notificationReceived = await this.app.evaluate(async () => {

        });

        if (!notificationReceived) {
            throw new Error('Notification was not received on Windows.');
        }
    });
    env.shouldTest(it, process.platform === 'linux')('should receive a notification on Ubuntu', async () => {
        await firstServer.click('div#CustomizeYourExperienceTour > button');
        const sendNotificationButton = await firstServer.waitForSelector('.btn-primary');
        await sendNotificationButton.scrollIntoViewIfNeeded();
        await sendNotificationButton.click();
        await asyncSleep(1000);

        const notificationReceived = await this.app.evaluate(async () => {

        });

        if (!notificationReceived) {
            throw new Error('Notification was not received on Ubuntu.');
        }
    });
});

async function getNotification() {
    if (process.platform === 'darwin') {
        return getMacOSNotification();
    } else if (process.platform === 'win32') {
        return getWindowsNotification();
    } else if (process.platform === 'linux') {
        return getLinuxNotification();
    }
    throw new Error('Unsupported operating system');
}

async function getMacOSNotification() {
    const script = `
      tell application "System Events"
        set notificationCenter to application process "NotificationCenter"
        set notifications to every UI element of notificationCenter
        if (count of notifications) > 0 then
          set latestNotification to item 1 of notifications
          set notificationTitle to name of latestNotification
          set notificationBody to value of static text 2 of latestNotification
          return notificationTitle & "|" & notificationBody
        else
          return "No notifications"
        end if
      end tell
    `;

    try {
        const result = execSync(`osascript -e '${script}'`, {encoding: 'utf8'});
        const [title, body] = result.trim().split('|');
        return {title, body};
    } catch (error) {
        console.error('Error retrieving macOS notification:', error);
        return null;
    }
}
