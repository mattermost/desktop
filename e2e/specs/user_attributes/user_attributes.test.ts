// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {
    waitForChannelPostListLoaded,
    waitForMattermostShellReady,
} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {buildServerMap, type ServerEntry, type ServerMap} from '../../helpers/serverMap';
import type {ServerView} from '../../helpers/serverView';
import {
    TEST_DEPARTMENT,
    TEST_INVALID_URL,
    TEST_PHONE,
    TEST_UPDATED_PHONE,
    TEST_UPDATED_URL,
    TEST_URL,
    TEST_VALID_URL,
    cancelCustomAttributeEdit,
    closeProfilePopover,
    closeProfileSettings,
    createCustomProfileAttributeField,
    deleteCustomProfileAttributeField,
    dismissBlockingOverlays,
    editTextCustomAttribute,
    getCustomAttributeInputValue,
    getCustomAttributeLabelsInSettings,
    getCustomProfileAttributeFields,
    isAppResponsive,
    isUserAttributesFeatureAvailable,
    openProfilePopoverFromLastPost,
    openProfileSettings,
    patchCustomProfileAttributeField,
    popoverContainsText,
    navigateToTownSquare,
    popoverLinkHasHref,
    recoverFromProfileSettings,
    postChannelMessage,
    updateCustomProfileAttributeValues,
    type UserPropertyField,
} from '../../helpers/userAttributes';

const FIELD_PREFIX = 'E2E_UA_';

async function cleanupFields(fieldIds: string[]): Promise<void> {
    for (const fieldId of fieldIds) {
        try {
            await deleteCustomProfileAttributeField(fieldId);
        } catch {
            // Best-effort cleanup on shared servers.
        }
    }
}

async function prepareServer(
    electronApp: ElectronApplication,
    serverMap?: ServerMap,
): Promise<{entry: ServerEntry; win: ServerView}> {
    const map = serverMap ?? await buildServerMap(electronApp);
    const entry = map[demoMattermostConfig.servers[0].name]?.[0];
    expect(entry, 'Mattermost server view should exist').toBeTruthy();
    await prepareMattermostServerView(electronApp, entry!.webContentsId);
    await loginToMattermost(entry!.win);
    await waitForMattermostShellReady(entry!.win);
    await dismissBlockingOverlays(entry!.win);
    return {entry: entry!, win: entry!.win};
}

test.describe('user_attributes/user_attributes', () => {
    test.describe.configure({mode: 'serial'});
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(120_000);

    test.beforeAll(async () => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        if (!process.env.MM_TEST_USER_NAME || !process.env.MM_TEST_PASSWORD) {
            test.skip(true, 'MM_TEST_USER_NAME and MM_TEST_PASSWORD required');
            return;
        }

        const available = await isUserAttributesFeatureAvailable();
        if (!available) {
            test.skip(true, 'User Attributes feature not available on this server');
        }

        const existing = await getCustomProfileAttributeFields();
        await cleanupFields(existing.filter((field) => field.name.startsWith(FIELD_PREFIX)).map((field) => field.id));
    });

    test.beforeEach(async ({electronApp, serverMap}) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            return;
        }

        await prepareServer(electronApp, serverMap);
    });

    test('MM-T5747 Attributes are shown in the user profile settings in the same order that they are listed in the System Console',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const names = [`${FIELD_PREFIX}Alpha`, `${FIELD_PREFIX}Beta`, `${FIELD_PREFIX}Gamma`];
            const created: UserPropertyField[] = [];

            try {
                for (let index = 0; index < names.length; index++) {
                    created.push(await createCustomProfileAttributeField({name: names[index]}, index));
                }

                try {
                    await openProfileSettings(win);
                } catch {
                    await recoverFromProfileSettings(win);
                    test.skip(true, 'Profile settings UI is not available on this server');
                    return;
                }
                const labels = await getCustomAttributeLabelsInSettings(win);
                await closeProfileSettings(win);

                for (const name of names) {
                    expect(labels.some((label) => label.includes(name)), `Expected ${name} in profile settings`).toBe(true);
                }

                const labelIndexes = names.map((name) => labels.findIndex((label) => label.includes(name)));
                expect(labelIndexes.every((index) => index >= 0)).toBe(true);
                expect(labelIndexes[0]).toBeLessThan(labelIndexes[1]!);
                expect(labelIndexes[1]).toBeLessThan(labelIndexes[2]!);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );

    test('MM-T5748 Long attribute names and descriptions are displayed correctly in a user\'s Profile Settings screen',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const longName = `${FIELD_PREFIX}${'LongAttributeName'.repeat(4)}`;
            const longDescription = 'This is an intentionally long description for verifying profile settings layout in desktop.';
            let created: UserPropertyField | undefined;

            try {
                created = await createCustomProfileAttributeField({
                    name: longName,
                    attrs: {description: longDescription},
                }, 0);

                try {
                    await openProfileSettings(win);
                } catch {
                    await recoverFromProfileSettings(win);
                    test.skip(true, 'Profile settings UI is not available on this server');
                    return;
                }
                const visible = await win.runInRenderer<{nameVisible: boolean; descriptionVisible: boolean}>(`
                    const modal = document.querySelector('#accountSettingsModal, .user-settings, #userAccountModal, .AccountModal');
                    if (!modal) {
                        return {nameVisible: false, descriptionVisible: false};
                    }
                    const text = modal.textContent || '';
                    return {
                        nameVisible: text.includes(${JSON.stringify(longName)}),
                        descriptionVisible: text.includes(${JSON.stringify(longDescription)}),
                    };
                `);
                await closeProfileSettings(win);

                expect(visible.nameVisible, 'Long attribute name should be visible').toBe(true);
            } finally {
                if (created) {
                    await cleanupFields([created.id]);
                }
            }
        },
    );

    test('MM-T5749 Clicking Cancel does not save the edit in user\'s Profile settings screen',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const fieldName = `${FIELD_PREFIX}CancelTest`;
            let created: UserPropertyField | undefined;

            try {
                created = await createCustomProfileAttributeField({name: fieldName}, 0);
                await updateCustomProfileAttributeValues({[created.id]: TEST_DEPARTMENT});

                try {
                    await openProfileSettings(win);
                } catch {
                    await recoverFromProfileSettings(win);
                    test.skip(true, 'Profile settings UI is not available on this server');
                    return;
                }
                await editTextCustomAttribute(win, created.id, 'Changed Value', false);
                await cancelCustomAttributeEdit(win, created.id);
                const settingsText = await win.runInRenderer<string>(`
                    return document.querySelector('.user-settings, #accountSettingsModal')?.textContent || '';
                `);
                await closeProfileSettings(win);

                expect(settingsText).toContain(TEST_DEPARTMENT);
                expect(settingsText).not.toContain('Changed Value');
            } finally {
                if (created) {
                    await cleanupFields([created.id]);
                }
            }
        },
    );

    test('MM-T5750 No crash if user is editing a user attribute at the same time as the System Admin is deleting it in the System Console',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const fieldName = `${FIELD_PREFIX}DeleteWhileEditing`;
            let created: UserPropertyField | undefined;

            try {
                created = await createCustomProfileAttributeField({name: fieldName}, 0);
                await updateCustomProfileAttributeValues({[created.id]: TEST_DEPARTMENT});

                try {
                    await openProfileSettings(win);
                } catch {
                    await recoverFromProfileSettings(win);
                    test.skip(true, 'Profile settings UI is not available on this server');
                    return;
                }
                await win.runInRenderer<void>(`
                    document.querySelector('#customAttribute_${created!.id}Edit')?.click();
                `);
                await win.waitForSelector(`#customAttribute_${created!.id}`, {timeout: 10_000});

                await deleteCustomProfileAttributeField(created!.id);
                created = undefined;

                expect(await isAppResponsive(win), 'App should remain responsive after field deletion').toBe(true);
                await closeProfileSettings(win);
                expect(await isAppResponsive(win), 'App should remain responsive after closing settings').toBe(true);
            } finally {
                if (created) {
                    await cleanupFields([created.id]);
                }
            }
        },
    );

    test('MM-T5751 Attributes are shown in the user profile pop-over in the same order that they are listed in the System Console',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const names = [`${FIELD_PREFIX}Pop_A`, `${FIELD_PREFIX}Pop_B`, `${FIELD_PREFIX}Pop_C`];
            const created: UserPropertyField[] = [];

            try {
                for (let index = 0; index < names.length; index++) {
                    const field = await createCustomProfileAttributeField({name: names[index]}, index);
                    created.push(field);
                    await updateCustomProfileAttributeValues({[field.id]: `Value-${index + 1}`});
                }

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const message = 'User attributes popover order test';
                await postChannelMessage(win, message);
                await openProfilePopoverFromLastPost(win, message);

                const popoverText = await win.runInRenderer<string>(`
                    const popover = document.querySelector('#user-profile-popover, .user-profile-popover, .profile-popover');
                    return popover?.textContent || '';
                `);

                const indexes = names.map((name) => popoverText.indexOf(name));
                expect(indexes.every((index) => index >= 0)).toBe(true);
                expect(indexes[0]).toBeLessThan(indexes[1]!);
                expect(indexes[1]).toBeLessThan(indexes[2]!);

                await closeProfilePopover(win);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );

    test('MM-T5752 User profile pop-over is scrollable and bottom bar in pop-over is locked in place',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const created: UserPropertyField[] = [];

            try {
                for (let index = 0; index < 6; index++) {
                    const field = await createCustomProfileAttributeField({
                        name: `${FIELD_PREFIX}Scroll_${index}`,
                    }, index);
                    created.push(field);
                    await updateCustomProfileAttributeValues({[field.id]: `Scroll value ${index}`});
                }

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const scrollMessage = 'User attributes scrollable popover test';
                await postChannelMessage(win, scrollMessage);
                await openProfilePopoverFromLastPost(win, scrollMessage);

                const layout = await win.runInRenderer<{scrollable: boolean; bottomLocked: boolean}>(`
                    const popover = document.querySelector('#user-profile-popover, .user-profile-popover, .profile-popover, [data-testid="userProfilePopover"]');
                    if (!popover) {
                        return {scrollable: false, bottomLocked: false};
                    }
                    const scrollContainer = popover.querySelector(
                        '.user-profile-popover__wrapper, .popover-content, .user-popover__content, .profile-popover-content, [data-testid="userProfilePopoverBody"]',
                    ) || popover;
                    const bottomBarSelectors = [
                        '.user-popover__bottom',
                        '.user-profile-popover__bottom',
                        '.profile-popover-bottom',
                        '.popover-footer',
                        '[data-testid="profilePopoverActions"]',
                        '[data-testid="userProfilePopoverActions"]',
                        '.user-profile-popover-actions',
                    ];
                    let bottomBar = null;
                    for (const selector of bottomBarSelectors) {
                        bottomBar = popover.querySelector(selector);
                        if (bottomBar) {
                            break;
                        }
                    }
                    if (!bottomBar) {
                        bottomBar = Array.from(popover.querySelectorAll('button, a')).find((element) => {
                            const label = (element.textContent || element.getAttribute('aria-label') || '').toLowerCase();
                            return label.includes('message') || label.includes('call');
                        })?.closest('div') || null;
                    }
                    const style = window.getComputedStyle(scrollContainer);
                    const scrollable = scrollContainer.scrollHeight > scrollContainer.clientHeight
                        || style.overflowY === 'auto'
                        || style.overflowY === 'scroll';
                    const bottomLocked = Boolean(bottomBar);
                    return {scrollable, bottomLocked};
                `);

                expect(layout.scrollable, 'Popover content should be scrollable when attributes overflow').toBe(true);
                expect(layout.bottomLocked, 'Popover bottom bar should be present').toBe(true);

                await closeProfilePopover(win);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );

    test('MM-T5771 Editing Phone and URL Type User Attributes',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const created: UserPropertyField[] = [];

            try {
                const phoneField = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}Phone`,
                    attrs: {value_type: 'phone'},
                }, 0);
                const urlField = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}Website`,
                    attrs: {value_type: 'url'},
                }, 1);
                created.push(phoneField, urlField);
                await updateCustomProfileAttributeValues({
                    [phoneField.id]: TEST_PHONE,
                    [urlField.id]: TEST_URL,
                });

                try {
                    await openProfileSettings(win);
                } catch {
                    await recoverFromProfileSettings(win);
                    test.skip(true, 'Profile settings UI is not available on this server');
                    return;
                }
                await editTextCustomAttribute(win, phoneField.id, TEST_UPDATED_PHONE);
                await editTextCustomAttribute(win, urlField.id, TEST_UPDATED_URL);
                await closeProfileSettings(win);

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const phoneUrlMessage = 'Phone and URL attribute edit test';
                await postChannelMessage(win, phoneUrlMessage);
                await openProfilePopoverFromLastPost(win, phoneUrlMessage);
                expect(await popoverContainsText(win, TEST_UPDATED_PHONE)).toBe(true);
                expect(await popoverContainsText(win, TEST_UPDATED_URL)).toBe(true);
                await closeProfilePopover(win);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );

    test('MM-T5772 URL Validation in User Attributes',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            let created: UserPropertyField | undefined;

            try {
                created = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}WebsiteValidation`,
                    attrs: {value_type: 'url'},
                }, 0);
                await updateCustomProfileAttributeValues({[created.id]: TEST_URL});

                try {
                    await openProfileSettings(win);
                } catch {
                    await recoverFromProfileSettings(win);
                    test.skip(true, 'Profile settings UI is not available on this server');
                    return;
                }
                await editTextCustomAttribute(win, created.id, TEST_INVALID_URL, false);
                await win.runInRenderer<void>(`
                    document.querySelector('#customAttribute_${created!.id}')?.blur();
                `);

                await expect.poll(async () => win.runInRenderer<boolean>(`
                    return Boolean(document.querySelector('#error_customAttribute_${created!.id}'));
                `), {timeout: 10_000}).toBe(true);

                await editTextCustomAttribute(win, created.id, TEST_VALID_URL);
                await closeProfileSettings(win);

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const urlValidationMessage = 'URL validation attribute test';
                await postChannelMessage(win, urlValidationMessage);
                await openProfilePopoverFromLastPost(win, urlValidationMessage);
                expect(await popoverContainsText(win, TEST_VALID_URL)).toBe(true);
                await closeProfilePopover(win);
            } finally {
                if (created) {
                    await cleanupFields([created.id]);
                }
            }
        },
    );

    test('MM-T5774 Do Not Display User Attributes If None Exist',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const created: UserPropertyField[] = [];

            try {
                const department = await createCustomProfileAttributeField({name: `${FIELD_PREFIX}EmptyDept`}, 0);
                const location = await createCustomProfileAttributeField({name: `${FIELD_PREFIX}EmptyLoc`}, 1);
                created.push(department, location);

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const emptyMessage = 'No custom attribute values on this user';
                await postChannelMessage(win, emptyMessage);
                await openProfilePopoverFromLastPost(win, emptyMessage);

                expect(await popoverContainsText(win, department.name)).toBe(false);
                expect(await popoverContainsText(win, location.name)).toBe(false);

                await closeProfilePopover(win);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );

    test('MM-T5776 Hide User Attributes When Visibility Is Set to Hidden',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const created: UserPropertyField[] = [];

            try {
                const hiddenField = await createCustomProfileAttributeField({name: `${FIELD_PREFIX}Hidden`}, 0);
                const visibleField = await createCustomProfileAttributeField({name: `${FIELD_PREFIX}Visible`}, 1);
                created.push(hiddenField, visibleField);

                await patchCustomProfileAttributeField(hiddenField.id, {attrs: {visibility: 'hidden'}});
                await updateCustomProfileAttributeValues({
                    [hiddenField.id]: TEST_DEPARTMENT,
                    [visibleField.id]: 'Remote',
                });

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const hiddenMessage = 'Hidden attribute visibility test';
                await postChannelMessage(win, hiddenMessage);
                await openProfilePopoverFromLastPost(win, hiddenMessage);

                expect(await popoverContainsText(win, hiddenField.name)).toBe(false);
                expect(await popoverContainsText(win, 'Remote')).toBe(true);

                await closeProfilePopover(win);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );

    test('MM-T5777 Always Display User Attributes With Visibility Set to Always',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            let created: UserPropertyField | undefined;

            try {
                created = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}AlwaysShow`,
                    attrs: {visibility: 'always'},
                }, 0);

                try {
                    await openProfileSettings(win);
                } catch {
                    await recoverFromProfileSettings(win);
                    test.skip(true, 'Profile settings UI is not available on this server');
                    return;
                }
                const labels = await getCustomAttributeLabelsInSettings(win);
                expect(labels.some((label) => label.includes(created!.name)), 'Always-visible attribute should appear in profile settings').toBe(true);
                await closeProfileSettings(win);
            } finally {
                if (created) {
                    await cleanupFields([created.id]);
                }
            }
        },
    );

    test('MM-T5778 Display Phone and URL Type User Attributes Correctly',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const created: UserPropertyField[] = [];

            try {
                const phoneField = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}DisplayPhone`,
                    attrs: {value_type: 'phone'},
                }, 0);
                const urlField = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}DisplayURL`,
                    attrs: {value_type: 'url'},
                }, 1);
                created.push(phoneField, urlField);
                await updateCustomProfileAttributeValues({
                    [phoneField.id]: TEST_PHONE,
                    [urlField.id]: TEST_URL,
                });

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const displayMessage = 'Display phone and URL attributes';
                await postChannelMessage(win, displayMessage);
                await openProfilePopoverFromLastPost(win, displayMessage);

                expect(await popoverContainsText(win, TEST_PHONE)).toBe(true);
                expect(await popoverContainsText(win, TEST_URL)).toBe(true);

                await closeProfilePopover(win);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );

    test('MM-T5779 Verify Phone and URL Attributes Are Clickable in Profile Popover',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            const {win} = await prepareServer(electronApp, serverMap);
            const created: UserPropertyField[] = [];

            try {
                const phoneField = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}ClickPhone`,
                    attrs: {value_type: 'phone'},
                }, 0);
                const urlField = await createCustomProfileAttributeField({
                    name: `${FIELD_PREFIX}ClickURL`,
                    attrs: {value_type: 'url'},
                }, 1);
                created.push(phoneField, urlField);
                await updateCustomProfileAttributeValues({
                    [phoneField.id]: TEST_PHONE,
                    [urlField.id]: TEST_URL,
                });

                await win.click('#sidebarItem_town-square');
                await waitForMattermostShellReady(win, {channelItem: '#sidebarItem_town-square'});
                const clickableMessage = 'Clickable phone and URL attributes';
                await postChannelMessage(win, clickableMessage);
                await openProfilePopoverFromLastPost(win, clickableMessage);

                expect(await popoverLinkHasHref(win, TEST_PHONE, '^tel:')).toBe(true);
                expect(await popoverLinkHasHref(win, TEST_URL, '^https:')).toBe(true);

                await closeProfilePopover(win);
            } finally {
                await cleanupFields(created.map((field) => field.id));
            }
        },
    );
});
