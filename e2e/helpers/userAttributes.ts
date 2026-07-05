// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ApiRequestError, apiLogin, apiRequest} from './server_api/client';
import {getTestServerCredentials} from './server_api/credentials';
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

export async function openProfileSettings(win: ServerView): Promise<void> {
    const opened = await win.runInRenderer<boolean>(`
        const menuBtn = document.querySelector('#userAccountMenuButton')
            || document.querySelector('.userAccountMenuButton')
            || document.querySelector('button[aria-label*="Account" i]');
        if (!menuBtn) {
            return false;
        }
        menuBtn.click();
        return true;
    `);
    if (!opened) {
        throw new Error('Could not open user account menu');
    }

    await win.waitForSelector('#userAccountModal, .AccountModal', {timeout: 15_000});

    await win.runInRenderer<void>(`
        const modal = document.querySelector('#userAccountModal, .AccountModal');
        if (!modal) {
            return;
        }
        const profileControl = Array.from(modal.querySelectorAll('button, a, [role="tab"], .SettingsModal__tab'))
            .find((element) => /^profile$/i.test((element.textContent || '').trim()));
        if (profileControl) {
            profileControl.click();
        }
    `);

    await win.waitForSelector('.user-settings, #userAccountModal_body', {timeout: 15_000});
}

export async function closeProfileSettings(win: ServerView): Promise<void> {
    await win.runInRenderer<void>(`
        const modal = document.querySelector('#userAccountModal, .AccountModal');
        if (!modal) {
            return;
        }
        const closeBtn = modal.querySelector('.modal-header button.close')
            || modal.querySelector('[aria-label="Close"]')
            || modal.querySelector('button.btn-tertiary');
        closeBtn?.click();
    `);
    await win.keyboard.press('Escape').catch(() => undefined);
    await win.waitForSelector('#userAccountModal, .AccountModal', {state: 'hidden', timeout: 5_000}).catch(() => undefined);
}

export async function getCustomAttributeLabelsInSettings(win: ServerView): Promise<string[]> {
    return win.runInRenderer<string[]>(`
        const modal = document.querySelector('#userAccountModal, .AccountModal');
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
            const section = button.closest('.setting-list-item, .settings-block, section, div');
            const label = section?.querySelector('label, .form__label, .setting-list-item__label, h3, h4');
            if (label?.textContent) {
                labels.push(label.textContent.trim());
                continue;
            }
            const nameEl = modal.querySelector('[for="customAttribute_' + fieldId + '"]');
            if (nameEl?.textContent) {
                labels.push(nameEl.textContent.trim());
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

export async function cancelCustomAttributeEdit(win: ServerView): Promise<void> {
    await win.click('button:has-text("Cancel")');
}

export async function getCustomAttributeInputValue(win: ServerView, fieldId: string): Promise<string> {
    return win.runInRenderer<string>(`
        const fieldId = ${JSON.stringify(fieldId)};
        const input = document.querySelector('#customAttribute_' + fieldId);
        if (!input) {
            return '';
        }
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
            return input.value;
        }
        return input.textContent || '';
    `);
}

export async function postChannelMessage(win: ServerView, message: string): Promise<void> {
    await win.runInRenderer<boolean>(`
        const candidates = [
            '#post_textbox',
            '[data-testid="post_textbox"]',
            '[data-slate-editor="true"]',
            '.post-create__input [contenteditable="true"]',
        ];
        for (const selector of candidates) {
            const element = document.querySelector(selector);
            if (element) {
                element.scrollIntoView({block: 'center'});
                element.focus?.();
                return true;
            }
        }
        return false;
    `);
    await win.keyboard.type(message);
    await win.keyboard.press('Enter');
    await win.waitForSelector('.post-list .post, [id^="post_"]', {timeout: 15_000});
}

export async function openProfilePopoverFromLastPost(win: ServerView): Promise<void> {
    const clicked = await win.runInRenderer<boolean>(`
        const posts = document.querySelectorAll('.post-list .post, .post-list__dynamic .post, [id^="post_"]');
        const lastPost = posts[posts.length - 1];
        if (!lastPost) {
            return false;
        }
        const trigger = lastPost.querySelector('.user-popover, .profile-icon, a.user-popover, .post__header .user-popover')
            || lastPost.querySelector('.post__header a');
        if (!trigger) {
            return false;
        }
        trigger.click();
        return true;
    `);
    if (!clicked) {
        throw new Error('Could not open profile popover from last post');
    }
    await win.waitForSelector(
        '#user-profile-popover, .user-profile-popover, .profile-popover, [role="tooltip"].popover',
        {timeout: 15_000},
    );
}

export async function closeProfilePopover(win: ServerView): Promise<void> {
    await win.click('#channelHeaderTitle').catch(() => undefined);
    await win.keyboard.press('Escape').catch(() => undefined);
}

export async function popoverContainsText(win: ServerView, text: string): Promise<boolean> {
    return win.runInRenderer<boolean>(`
        const popover = document.querySelector('#user-profile-popover, .user-profile-popover, .profile-popover');
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
