// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import type {ServerView} from '../../helpers/serverView';

export async function triggerTestNotification(firstServer: ServerView) {
    await firstServer.click('div#CustomizeYourExperienceTour > button');
    const sendNotificationButton = await firstServer.waitForSelector('.sectionNoticeButton.btn-primary');
    await sendNotificationButton.scrollIntoViewIfNeeded();
    const textBeforeClick = await sendNotificationButton.textContent();
    expect(textBeforeClick).toBe('Send a test notification');
    await sendNotificationButton.click();
    await firstServer.waitForFunction(
        (el) => el.textContent === 'Test notification sent',
        await firstServer.waitForSelector('.sectionNoticeButton.btn-primary'),
        {timeout: 10_000},
    );
    const textAfterClick = await sendNotificationButton.textContent();
    expect(textAfterClick).toBe('Test notification sent');
}

export async function verifyNotificationReceivedInDM(firstServer: ServerView) {
    await firstServer.click('div.modal-header button[aria-label="Close"]');
    const sidebarLink = await firstServer.locator('a.SidebarLink:has-text("system-bot")');
    const badgeElement = await sidebarLink.locator('span.badge');
    const badgeCount = await badgeElement.textContent();
    expect(parseInt(badgeCount!, 10)).toBeGreaterThan(0);

    await sidebarLink.click();
    await firstServer.waitForSelector('div.post__body');

    const lastPostBody = firstServer.locator('div.post__body').last();
    const textContent = await lastPostBody.textContent();
    expect(textContent).toBe('If you received this test notification, it worked!');
}
