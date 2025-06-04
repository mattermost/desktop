// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const {asyncSleep} = require('../../modules/utils');

export async function triggerTestNotification(firstServer) {
    await firstServer.click('div#CustomizeYourExperienceTour > button');
    const sendNotificationButton = await firstServer.waitForSelector('.sectionNoticeButton.btn-primary');
    await sendNotificationButton.scrollIntoViewIfNeeded();
    const textBeforeClick = await sendNotificationButton.textContent();
    textBeforeClick.should.equal('Send a test notification');
    await sendNotificationButton.click();
    await asyncSleep(3000);
    const textAfterClick = await sendNotificationButton.textContent();
    textAfterClick.should.equal('Test notification sent');
}

export async function verifyNotificationRecievedinDM(firstServer, afterbadgeValue) {
    await firstServer.click('div.modal-header button[aria-label="Close"]');
    const sidebarLink = await firstServer.locator('a.SidebarLink:has-text("system-bot")');
    const badgeElement = await sidebarLink.locator('span.badge');
    const badgeCount = await badgeElement.textContent();
    parseInt(badgeCount, 10).should.equal(afterbadgeValue);

    sidebarLink.click();
    await asyncSleep(1000);

    const lastPostBody = await firstServer.locator('div.post__body').last();
    const textContent = await lastPostBody.textContent();
    textContent.should.equal('If you received this test notification, it worked!');
}
