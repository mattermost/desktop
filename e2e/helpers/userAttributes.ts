// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {ElectronApplication} from 'playwright';

import {
    pressPostTextboxKey,
    typeIntoPostTextbox,
    waitForChannelPostListLoaded,
    waitForMattermostShellReady,
} from './mattermostShell';
import {activateServerEntry, activateServerView} from './serverContext';
import {closeDownloadsDropdownIfOpen} from './downloadsDropdown';
import {closeOverlayWindowsIfOpen} from './overlayWindows';
import type {ServerEntry} from './serverMap';
import {ApiRequestError, apiLogin, apiRequest} from './server_api/client';
import {resolveChannelByName} from './server_api/channel';
import {getTestServerCredentials} from './server_api/credentials';
import {apiCreatePost} from './server_api/post';
import type {ServerView} from './serverView';

export type UserPropertyField = {
    id: string;
    name: string;
    type: string;
    attrs?: {
        sort_order?: number;
        visibility?: 'when_set' | 'hidden' | 'always';
        value_type?: string;
        description?: string;
        display_name?: string;
        options?: Array<{name: string; color?: string}>;
    };
};

export type CustomProfileAttributeDef = {
    name: string;
    type?: string;
    value?: string;
    attrs?: UserPropertyField['attrs'];
};

const CPA_FIELDS_PATH = '/api/v4/custom_profile_attributes/fields';

export const TEST_PHONE = '555-123-4567';
export const TEST_UPDATED_PHONE = '555-987-6543';
export const TEST_URL = 'https://example.com';
export const TEST_UPDATED_URL = 'https://mattermost.com';
export const TEST_INVALID_URL = 'ftp://invalid-url';
export const TEST_VALID_URL = 'https://example2.com';
export const TEST_DEPARTMENT = 'Engineering';

export async function isUserAttributesFeatureAvailable(): Promise<boolean> {
    try {
        const {baseUrl, username, password} = getTestServerCredentials();
        const token = await apiLogin(baseUrl, username, password);
        await apiRequest<UserPropertyField[]>(baseUrl, token, CPA_FIELDS_PATH);
        return true;
    } catch (error) {
        if (error instanceof ApiRequestError && [403, 404, 501].includes(error.status)) {
            return false;
        }
        throw error;
    }
}

export async function probeUserAttributesInProfileSettings(win: ServerView): Promise<boolean> {
    if (!(await isUserAttributesFeatureAvailable())) {
        return false;
    }

    await openProfileSettings(win);
    const hasProfileSurface = await win.runInRenderer<boolean>(`
        return Boolean(document.querySelector('#userAccountModal, .AccountModal'));
    `);
    await closeProfileSettings(win);
    return hasProfileSurface;
}

export async function getCustomProfileAttributeFields(): Promise<UserPropertyField[]> {
    const {baseUrl, username, password} = getTestServerCredentials();
    const token = await apiLogin(baseUrl, username, password);
    return apiRequest<UserPropertyField[]>(baseUrl, token, CPA_FIELDS_PATH);
}

export async function createCustomProfileAttributeField(
    field: CustomProfileAttributeDef,
    sortOrder: number,
): Promise<UserPropertyField> {
    const {baseUrl, username, password} = getTestServerCredentials();
    const token = await apiLogin(baseUrl, username, password);
    return apiRequest<UserPropertyField>(baseUrl, token, CPA_FIELDS_PATH, {
        method: 'POST',
        body: JSON.stringify({
            name: field.name,
            type: field.type ?? 'text',
            attrs: {
                sort_order: sortOrder,
                ...field.attrs,
            },
        }),
    });
}

export async function patchCustomProfileAttributeField(
    fieldId: string,
    patch: {name?: string; attrs?: UserPropertyField['attrs']},
): Promise<UserPropertyField> {
    const {baseUrl, username, password} = getTestServerCredentials();
    const token = await apiLogin(baseUrl, username, password);
    return apiRequest<UserPropertyField>(baseUrl, token, `${CPA_FIELDS_PATH}/${fieldId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

export async function deleteCustomProfileAttributeField(fieldId: string): Promise<void> {
    const {baseUrl, username, password} = getTestServerCredentials();
    const token = await apiLogin(baseUrl, username, password);
    await apiRequest<unknown>(baseUrl, token, `${CPA_FIELDS_PATH}/${fieldId}`, {method: 'DELETE'});
}

export async function updateCustomProfileAttributeValues(
    valuesByFieldId: Record<string, string | string[]>,
    userId = 'me',
): Promise<void> {
    const {baseUrl, username, password} = getTestServerCredentials();
    const token = await apiLogin(baseUrl, username, password);
    await apiRequest<unknown>(baseUrl, token, `/api/v4/users/${userId}/custom_profile_attributes`, {
        method: 'PATCH',
        body: JSON.stringify(valuesByFieldId),
    });
}

export async function navigateToTownSquare(win: ServerView): Promise<void> {
    const onTownSquare = await win.runInRenderer<boolean>(`
        const item = document.querySelector('#sidebarItem_town-square');
        return Boolean(item?.classList.contains('active') || item?.classList.contains('active-link') || item?.getAttribute('aria-current') === 'page');
    `);
    if (!onTownSquare) {
        await win.click('#sidebarItem_town-square');
    }
    await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
    await waitForChannelPostListLoaded(win);
}

const PROFILE_SETTINGS_MODAL_SELECTOR = [
    '#accountSettingsModal',
    '#userAccountModal',
    '.AccountModal',
    '.SettingsModal',
    '[data-testid="userSettingsModal"]',
    '[data-testid="accountSettingsModal"]',
].join(', ');

const PROFILE_SETTINGS_BODY_SELECTOR = [
    '.user-settings',
    '.UserSettingsModal',
    '#userAccountModal_body',
    '[data-testid="userSettingsModalBody"]',
    '[data-testid="accountSettingsModalBody"]',
].join(', ');

export async function openProfileSettings(win: ServerView): Promise<void> {
    const opened = await win.runInRenderer<boolean>(`
        const menuBtn = document.querySelector('#userAccountMenuButton');
        if (!menuBtn) {
            return false;
        }
        menuBtn.click();
        return true;
    `);
    if (!opened) {
        throw new Error('Could not open user account menu');
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    await win.runInRenderer<void>(`
        const profileEntry = Array.from(document.querySelectorAll('[role="menuitem"], .MenuItem'))
            .find((element) => /^profile$/i.test((element.textContent || '').trim()));
        if (!(profileEntry instanceof HTMLElement)) {
            throw new Error('Profile menu item not found');
        }
        profileEntry.click();
    `);

    await win.waitForSelector(PROFILE_SETTINGS_MODAL_SELECTOR, {timeout: 15_000});

    await win.runInRenderer<void>(`
        const modal = document.querySelector(${JSON.stringify(PROFILE_SETTINGS_MODAL_SELECTOR)});
        if (!modal) {
            return;
        }
        const profileSettingsNav = Array.from(modal.querySelectorAll('a, button, [role="tab"], [role="menuitem"]'))
            .find((element) => /profile settings/i.test((element.textContent || '').trim()));
        if (profileSettingsNav instanceof HTMLElement) {
            profileSettingsNav.click();
        }
    `);

    await win.waitForSelector(PROFILE_SETTINGS_BODY_SELECTOR, {timeout: 15_000});
}

export async function closeProfileSettings(win: ServerView): Promise<void> {
    await win.runInRenderer<void>(`
        const modal = document.querySelector(${JSON.stringify(PROFILE_SETTINGS_MODAL_SELECTOR)});
        if (!modal) {
            return;
        }
        const closeBtn = modal.querySelector('.modal-header button.close, button[aria-label="Close"], button.btn-icon-close');
        closeBtn?.click();
    `);
    await win.keyboard.press('Escape').catch(() => undefined);
    await win.waitForSelector(PROFILE_SETTINGS_MODAL_SELECTOR, {state: 'hidden', timeout: 5_000}).catch(() => undefined);
}

export async function recoverFromProfileSettings(win: ServerView): Promise<void> {
    await closeProfileSettings(win).catch(() => undefined);
    const hasSidebar = await win.runInRenderer<boolean>(`
        return Boolean(document.querySelector('#sidebarItem_town-square'));
    `);
    if (hasSidebar) {
        await navigateToTownSquare(win);
        return;
    }

    const channel = await resolveChannelByName('town-square');
    await win.runInRenderer<void>(`
        window.location.assign(${JSON.stringify(channel.url)});
    `);
    await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
    await waitForChannelPostListLoaded(win);
}

export async function getCustomAttributeLabelsInSettings(win: ServerView): Promise<string[]> {
    return win.runInRenderer<string[]>(`
        const modal = document.querySelector(${JSON.stringify(PROFILE_SETTINGS_MODAL_SELECTOR)})
            || document.querySelector('.user-settings');
        if (!modal) {
            return [];
        }
        const labels = [];
        const editButtons = modal.querySelectorAll('[id^="customAttribute_"][id$="Edit"]');
        for (const button of editButtons) {
            const match = button.id.match(/^customAttribute_(.+?)Edit$/);
            if (!match) {
                continue;
            }
            const fieldId = match[1];
            const nameEl = modal.querySelector('[for="customAttribute_' + fieldId + '"]');
            if (nameEl?.textContent) {
                labels.push(nameEl.textContent.trim());
                continue;
            }
            const row = button.closest('.setting-list-item, .SettingsBlock, section, li, div');
            const rowText = (row?.textContent || '')
                .replace(/Edit.*$/s, '')
                .replace(/Click 'Edit' to add your custom attribute/gi, '')
                .trim();
            if (rowText) {
                labels.push(rowText);
            }
        }
        return labels;
    `);
}

export async function editTextCustomAttribute(
    win: ServerView,
    fieldId: string,
    newValue: string,
    save = true,
): Promise<void> {
    await win.runInRenderer<void>(`
        const fieldId = ${JSON.stringify(fieldId)};
        const editBtn = document.querySelector('#customAttribute_' + fieldId + 'Edit');
        editBtn?.scrollIntoView({block: 'center'});
        editBtn?.click();
    `);
    await win.waitForSelector(`#customAttribute_${fieldId}`, {timeout: 10_000});
    await win.runInRenderer<void>(`
        const fieldId = ${JSON.stringify(fieldId)};
        const input = document.querySelector('#customAttribute_' + fieldId);
        if (!input) {
            throw new Error('Custom attribute input not found');
        }
        input.focus?.();
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
            input.value = '';
            input.dispatchEvent(new Event('input', {bubbles: true}));
        }
    `);
    if (newValue) {
        await win.fill(`#customAttribute_${fieldId}`, newValue);
    }
    if (save) {
        await win.click('button:has-text("Save")');
        await win.waitForSelector(`#customAttribute_${fieldId}Edit`, {timeout: 10_000});
    }
}

export async function cancelCustomAttributeEdit(win: ServerView, fieldId?: string): Promise<void> {
    await win.runInRenderer<void>(`
        const modal = document.querySelector('#accountSettingsModal, .user-settings, #userAccountModal, .AccountModal');
        const scope = modal || document;
        const cancelBtn = Array.from(scope.querySelectorAll('button'))
            .find((button) => (button.textContent || '').trim() === 'Cancel');
        cancelBtn?.click();
    `);
    if (fieldId) {
        await win.waitForSelector(`#customAttribute_${fieldId}Edit`, {timeout: 10_000});
    }
}

export async function getCustomAttributeInputValue(win: ServerView, fieldId: string): Promise<string> {
    return win.runInRenderer<string>(`
        const fieldId = ${JSON.stringify(fieldId)};
        const editBtn = document.querySelector('#customAttribute_' + fieldId + 'Edit');
        const input = document.querySelector('#customAttribute_' + fieldId);
        const editVisible = Boolean(editBtn && editBtn.getBoundingClientRect().width > 0);
        if (!editVisible && input instanceof HTMLInputElement) {
            return input.value;
        }
        if (!editBtn) {
            return input instanceof HTMLInputElement ? input.value : '';
        }
        const row = editBtn.closest('.setting-list-item, .SettingsBlock, section, li, div');
        if (!row) {
            return '';
        }
        let text = row.textContent || '';
        const labelEl = row.querySelector('label, .form__label, .setting-list-item__label, h4, h5, strong');
        const label = labelEl?.textContent?.trim() || '';
        if (label) {
            text = text.replace(label, '');
        }
        return text
            .replace(/Edit.*$/s, '')
            .replace(/Click 'Edit' to add your custom attribute/gi, '')
            .trim();
    `);
}

const PROFILE_POPOVER_SELECTOR = [
    '#user-profile-popover',
    '.user-profile-popover',
    '.profile-popover',
    '[data-testid="userProfilePopover"]',
    '[role="tooltip"].popover',
].join(', ');

const POST_PROFILE_TRIGGER_SELECTORS = [
    '[data-testid="postHeaderProfile"]',
    '[data-testid="profilePicture"]',
    '.post__header button.user-popover',
    '.post__header .user-popover',
    'a.user-popover',
    '.user-popover-profile-link',
    '.user-popover',
    '.profile-icon',
    'button[aria-label*="profile" i]',
];

export async function dismissBlockingOverlays(win: ServerView): Promise<void> {
    await closeDownloadsDropdownIfOpen(win.app);
    await closeOverlayWindowsIfOpen(win.app);
    await activateServerView(win.app, win.webContentsId);
    await win.keyboard.press('Escape').catch(() => undefined);
}

export async function postChannelMessage(
    win: ServerView,
    message: string,
    channelName = 'town-square',
): Promise<void> {
    await dismissBlockingOverlays(win);

    const channel = await resolveChannelByName(channelName);
    const onChannel = await win.runInRenderer<boolean>(`
        return window.location.pathname.includes('/channels/${channelName}');
    `);
    if (!onChannel) {
        await win.click(`#sidebarItem_${channelName}`);
        await waitForMattermostShellReady(win, {channelItem: `#sidebarItem_${channelName}`});
    }

    try {
        await typeIntoPostTextbox(win, message);
        const sent = await win.runInRenderer<boolean>(`
            const sendButton = document.querySelector(
                '#channelHeaderSubmitButton, button[aria-label*="Send" i], [data-testid="SendMessageButton"]',
            );
            if (!sendButton) {
                return false;
            }
            sendButton.click();
            return true;
        `);
        if (!sent) {
            await pressPostTextboxKey(win, 'Enter');
        }
    } catch {
        await apiCreatePost(channel.id, message);
    }

    await expect.poll(
        async () => win.runInRenderer<boolean>(`
            const message = ${JSON.stringify(message)};
            return Array.from(document.querySelectorAll('.post-message__text, .post__body, .post'))
                .some((element) => (element.textContent || '').includes(message));
        `),
        {timeout: 20_000, message: 'Posted message must appear in channel'},
    ).toBe(true);
}

export async function openProfilePopoverFromLastPost(
    win: ServerView,
    messageHint?: string,
): Promise<void> {
    const clickProfileTrigger = async (): Promise<boolean> => {
        await dismissBlockingOverlays(win);
        await waitForChannelPostListLoaded(win);

        return win.runInRenderer<boolean>(`
        const messageHint = ${JSON.stringify(messageHint ?? '')};
        const triggerSelectors = ${JSON.stringify(POST_PROFILE_TRIGGER_SELECTORS)};
        const posts = Array.from(document.querySelectorAll('.post-list .post, .post-list__dynamic .post, [id^="post_"]'));
        const resolveTrigger = (post) => {
            for (const selector of triggerSelectors) {
                const trigger = post.querySelector(selector);
                if (trigger instanceof HTMLElement) {
                    return trigger;
                }
            }
            const header = post.querySelector('.post__header');
            const fallback = header?.querySelector(
                '.user-popover, a.user-popover, [data-testid="postHeaderProfile"], [data-testid="profilePicture"]',
            );
            return fallback instanceof HTMLElement ? fallback : null;
        };
        const candidates = messageHint
            ? posts.filter((post) => (post.textContent || '').includes(messageHint))
            : posts;
        const searchPosts = candidates.length > 0 ? candidates : posts;

        for (let index = searchPosts.length - 1; index >= 0; index--) {
            const trigger = resolveTrigger(searchPosts[index]);
            if (trigger) {
                trigger.scrollIntoView({block: 'center'});
                trigger.click();
                return true;
            }
        }
        return false;
    `);
    };

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (await clickProfileTrigger()) {
            try {
                await win.waitForSelector(PROFILE_POPOVER_SELECTOR, {timeout: 5_000});
                return;
            } catch {
                await dismissBlockingOverlays(win);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error('Could not open profile popover from last post');
}

export async function postAndOpenProfilePopover(
    electronApp: ElectronApplication,
    entry: ServerEntry,
    message: string,
    channelName = 'town-square',
): Promise<void> {
    await activateServerEntry(electronApp, entry);
    await dismissBlockingOverlays(entry.win);

    if (channelName === 'town-square') {
        await navigateToTownSquare(entry.win);
    } else {
        await entry.win.click(`#sidebarItem_${channelName}`);
        await waitForMattermostShellReady(entry.win, {channelItem: `#sidebarItem_${channelName}`});
        await waitForChannelPostListLoaded(entry.win);
    }

    await postChannelMessage(entry.win, message, channelName);
    await openProfilePopoverFromLastPost(entry.win, message);
}

export async function closeProfilePopover(win: ServerView): Promise<void> {
    await win.click('#channelHeaderTitle').catch(() => undefined);
    await win.keyboard.press('Escape').catch(() => undefined);
}

export async function popoverContainsText(win: ServerView, text: string): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        const popover = document.querySelector(${JSON.stringify(PROFILE_POPOVER_SELECTOR)});
        if (!popover) {
            return false;
        }
        return (popover.textContent || '').includes(${JSON.stringify(text)});
    `);
}

export async function popoverLinkHasHref(win: ServerView, text: string, hrefPattern: string): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        const popover = document.querySelector('#user-profile-popover, .user-profile-popover, .profile-popover');
        if (!popover) {
            return false;
        }
        const links = popover.querySelectorAll('a');
        const pattern = new RegExp(${JSON.stringify(hrefPattern)});
        for (const link of links) {
            if ((link.textContent || '').includes(${JSON.stringify(text)})) {
                return pattern.test(link.getAttribute('href') || '');
            }
        }
        return false;
    `);
}

export async function isAppResponsive(win: ServerView): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        return Boolean(
            document.querySelector('#sidebarItem_town-square')
            && document.querySelector('#channelHeaderTitle'),
        );
    `);
}
