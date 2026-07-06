// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {pressPostTextboxKey, recoverInteractiveChannel, waitForMattermostShellReady} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {getFilePublicLink, isPublicLinkEnabled} from '../../helpers/server_api/publicLinks';
import type {ServerView} from '../../helpers/serverView';

// 64x64 PNG — above Mattermost's 48px inline-image minimum so thumbnails render visibly.
const PREVIEW_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAf0lEQVR4nNXOQREAIAzAsFJJ8y8FMYjgsWsU5NwZyiRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4twO/HqSogHAzFmDswAAAABJRU5ErkJggg==';

const PREVIEW_MODAL_SELECTOR = [
    '.file-preview-modal',
    '.modal-image.in',
    '.modal-image.show',
    '#viewImageModalLabel',
].join(', ');

const POSTED_IMAGE_SELECTOR = [
    '.post-image .small-image__container',
    '.post-image .image-loaded-container',
    '.post-image__image',
    '.post-image img',
    '.file-viewer-touch',
    '.file-attachment',
    '.post--attachment img',
    'img[src*="/api/v4/files/"]',
].join(', ');

async function submitComposerPost(serverWin: ServerView): Promise<void> {
    const sent = await serverWin.runInRenderer<boolean>(`
        const sendButton = document.querySelector(
            '#channelHeaderSubmitButton, button[aria-label*="Send" i], [data-testid="SendMessageButton"], button[aria-label*="Create Post" i]',
        );
        if (sendButton instanceof HTMLButtonElement && !sendButton.disabled) {
            sendButton.click();
            return true;
        }
        return false;
    `, true);

    if (!sent) {
        await pressPostTextboxKey(serverWin, 'Enter');
    }
}

async function waitForPostedAttachment(serverWin: ServerView): Promise<void> {
    await expect.poll(async () => serverWin.runInRenderer<boolean>(`
        const attachmentSelector = ${JSON.stringify(POSTED_IMAGE_SELECTOR)};
        const composer = document.querySelector('#post-create, .AdvancedTextEditor, .post-create, [data-testid="post-create"]');
        const draftAttachment = composer?.querySelector('.file-preview, .file-preview__container, .attachment-preview');
        if (draftAttachment) {
            return false;
        }

        const posts = Array.from(document.querySelectorAll('.post'));
        for (let index = posts.length - 1; index >= 0; index--) {
            const post = posts[index];
            if (post.querySelector(attachmentSelector) ||
                post.querySelector('[aria-label*="e2e-preview.png" i], [aria-label*="file thumbnail" i]')) {
                post.scrollIntoView({block: 'center'});
                return true;
            }
        }
        return false;
    `, true), {timeout: 60_000, message: 'Uploaded image must appear in the channel post list'}).toBe(true);
}

async function uploadAndPostPng(serverWin: ServerView): Promise<void> {
    const uploaded = await serverWin.runInRenderer<boolean>(`
        const pngBase64 = ${JSON.stringify(PREVIEW_PNG_BASE64)};
        const binary = atob(pngBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], 'e2e-preview.png', {type: 'image/png'});

        const input = document.querySelector('#fileUploadInput, input[type="file"]');
        if (!(input instanceof HTMLInputElement)) {
            return false;
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
        return true;
    `, true);
    expect(uploaded, 'Image upload input must accept a PNG attachment').toBe(true);

    await expect.poll(async () => serverWin.runInRenderer<boolean>(`
        return Boolean(
            document.querySelector('.file-preview, .post-image, .attachment, .file-preview__container, .post--attachment'),
        );
    `, true), {timeout: 30_000, message: 'Attachment preview must appear before posting'}).toBe(true);

    await expect.poll(async () => serverWin.runInRenderer<boolean>(`
        const sendButton = document.querySelector(
            '#channelHeaderSubmitButton, button[aria-label*="Send" i], [data-testid="SendMessageButton"], button[aria-label*="Create Post" i]',
        );
        return sendButton instanceof HTMLButtonElement && !sendButton.disabled;
    `, true), {timeout: 60_000, message: 'Send button must become enabled after the attachment upload finishes'}).toBe(true);

    await submitComposerPost(serverWin);
    await recoverInteractiveChannel(serverWin, {channelItem: '#sidebarItem_town-square'});

    await waitForPostedAttachment(serverWin);
}

async function isImagePreviewOpen(serverWin: ServerView): Promise<boolean> {
    return serverWin.runInRenderer<boolean>(`
        const selector = ${JSON.stringify(PREVIEW_MODAL_SELECTOR)};
        if (document.querySelector(selector)) {
            return true;
        }

        const previewImage = document.querySelector('[data-testid="imagePreview"]');
        const modal = previewImage?.closest('.modal, .file-preview-modal, .modal-image');
        return Boolean(modal && (modal.classList.contains('in') || modal.classList.contains('show')));
    `, true);
}

async function openImagePreview(serverWin: ServerView): Promise<boolean> {
    return serverWin.runInRenderer<boolean>(`
        const attachmentSelector = ${JSON.stringify(POSTED_IMAGE_SELECTOR)};
        const posts = Array.from(document.querySelectorAll('.post'));
        let root = null;
        for (let index = posts.length - 1; index >= 0; index--) {
            const post = posts[index];
            if (post.querySelector(attachmentSelector) ||
                post.querySelector('[aria-label*="e2e-preview.png" i], [aria-label*="file thumbnail" i]')) {
                root = post;
                break;
            }
        }
        if (!root) {
            return false;
        }

        const clickTargets = [
            root.querySelector('[aria-label*="e2e-preview.png" i]'),
            root.querySelector('[aria-label*="file thumbnail" i]'),
            root.querySelector('.post-image .small-image__container'),
            root.querySelector('.post-image .image-loaded-container'),
            root.querySelector('.post-image__image'),
            root.querySelector('.post-image img'),
            root.querySelector('.file-viewer-touch'),
            root.querySelector('.file-attachment'),
            root.querySelector('.post--attachment img'),
            root.querySelector('img[src*="/api/v4/files/"]'),
            root.querySelector('.post-image'),
            root.querySelector('.post--attachment'),
        ].filter(Boolean);

        const target = clickTargets[0];
        if (!target) {
            return false;
        }

        target.scrollIntoView({block: 'center', inline: 'center'});
        if (target instanceof HTMLElement) {
            target.click();
        }
        return true;
    `, true);
}

async function closeImagePreview(serverWin: ServerView): Promise<boolean> {
    return serverWin.runInRenderer<boolean>(`
        const closeButton = document.querySelector(
            '.file-preview-modal [aria-label="Close"], .modal-image [aria-label="Close"], .modal-image.in [aria-label="Close"], .modal-image.show [aria-label="Close"]',
        );
        closeButton?.click();
        const selector = ${JSON.stringify(PREVIEW_MODAL_SELECTOR)};
        return !Boolean(document.querySelector(selector));
    `, true);
}

async function getPreviewFileId(serverWin: ServerView): Promise<string | null> {
    return serverWin.runInRenderer<string | null>(`
        const sources = [
            document.querySelector('[data-testid="imagePreview"]')?.getAttribute('src'),
            document.querySelector('.file-preview-modal img')?.getAttribute('src'),
            document.querySelector('.post-image img[src*="/files/"]')?.getAttribute('src'),
            document.querySelector('img[src*="/api/v4/files/"]')?.getAttribute('src'),
        ].filter(Boolean);

        for (const source of sources) {
            const match = String(source).match(/\\/files\\/([a-z0-9]+)/i);
            if (match) {
                return match[1];
            }
        }

        return null;
    `, true);
}

test.describe('mattermost/media_preview', () => {
    test.use({appConfig: demoMattermostConfig});
    test.setTimeout(180_000);

    test(
        'MM-T4054 Open/Close permanent link media preview',
        {tag: ['@P2', '@all']},
        async ({electronApp, serverMap}) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }

            const publicLinksEnabled = await isPublicLinkEnabled();
            if (!publicLinksEnabled) {
                test.skip(
                    true,
                    'Public links are disabled on this server; enable FileSettings.EnablePublicLink (CI runs e2e/scripts/enable-public-links.mjs before tests)',
                );
                return;
            }

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            expect(serverEntry?.win, 'Mattermost server view should exist').toBeTruthy();
            const serverWin = serverEntry!.win;

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(serverWin);
            await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_town-square'});
            await serverWin.click('#sidebarItem_town-square');

            await uploadAndPostPng(serverWin);

            await expect.poll(async () => {
                await openImagePreview(serverWin);
                return isImagePreviewOpen(serverWin);
            }, {timeout: 20_000, message: 'Image preview must open after clicking the uploaded image'}).toBe(true);

            const fileId = await getPreviewFileId(serverWin);
            expect(fileId, 'Previewed image must expose a file id').toBeTruthy();
            const publicLink = await getFilePublicLink(fileId!);
            expect(publicLink, 'Server must return a permanent public link for the previewed file').toMatch(/\/files\/.*\/public/);

            await expect.poll(
                () => closeImagePreview(serverWin),
                {timeout: 10_000, message: 'Image preview must close from the preview modal'},
            ).toBe(true);
        },
    );
});
