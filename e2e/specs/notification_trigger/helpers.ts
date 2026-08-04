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
    const sidebarLink = firstServer.locator('a.SidebarLink:has-text("system-bot")');
    const badgeElement = sidebarLink.locator('span.badge');

    await expect.poll(async () => {
        if (await badgeElement.count() === 0) {
            return 0;
        }
        const text = (await badgeElement.textContent())?.trim() ?? '';
        const parsed = parseInt(text, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }, {timeout: 15_000, message: 'system-bot sidebar badge must show unread count'}).toBeGreaterThan(0);

    await sidebarLink.click();
    await firstServer.waitForSelector('div.post__body');

    const lastPostBody = firstServer.locator('div.post__body').last();
    const textContent = await lastPostBody.textContent();
    expect(textContent).toBe('If you received this test notification, it worked!');
}
