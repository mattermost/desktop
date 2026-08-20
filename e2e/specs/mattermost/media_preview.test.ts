// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {pressPostTextboxKey, recoverInteractiveChannel, waitForMattermostShellReady} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {getFilePublicLink, isPublicLinkEnabled} from '../../helpers/server_api/publicLinks';
import type {ServerView} from '../../helpers/serverView';

// Valid 128x128 PNG. The previous fixture was rejected by the server decoder
// ("png: invalid format: too much pixel data"), so no preview was generated and
// SizeAwareImage (MM-69174 / 11.10+) ignored clicks until load forever.
const PREVIEW_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAACx0lEQVR4nO3dsVEbQRhH8ZWHOuyAHogcEVAClTgmcGpX4hIIlNgRPRC4EjnYmRuNYARrab/3P/R+kQMh43333Z1kFm12u10b8eXnn6HH//321ec/4tPQo3V2BoAZAGYAmAFgBoAZAGYAmAFgBoAZAGYAmAFgBoAZAHaV9v74pT2/EwAzAMwAMAPADAAzAMwAMAPADAAzAMwAMAPADAAzAMwAsM3q9gdsf30//oDrp8dTnv/A7P8/uBp6NOXNRd/3fHO3/Pl4jATRAYbW/VVLjNgSoQFOX/oDvURghrgAZ1/6fc83d9vWbu8f5v0Vo7LugvZP3/NMbTwqZQJqln7RGySMQsQEFK/+ImEU+ADU6nd4AzgAu/od24AMkLD6HdgAC5Cz+h3VgAmQtvod0gAIkLn6XX0D/i7owlUHSD78u+Ih2Hz+8XvoC055fxy/6X6/5W079wd8cHUBVnT4t8JTpRMAKwqwrsO/qxkCJwBmAFhFgDWef7qCs5ATADMAzACw6QHWewHoZn//TgDMADADwAwAm74/YO0X4Tb4I71+fsDKGABmAJgBYAaATQ8QuCtoyOzv3wmAGQBmAFhFgPVeBgo2kTkBMAPAigKs8SxUs4nVCYDVBVjXEJTt4S79/IDt0Feiln/mh9ofkPCrAd6jclirrwH5DYpPlV6EYUCA5CGov1NgJiCzAXKfhp2C0hpQd8nkNSCnAfgaBb4IJzRgXyHyd0FsA/z1OR+gcQ3w1W85v7SvNyj7OcaEpe8iJmBRMwo5q9/SArTWrp8e5y3Q7f1D1Oq3nFPQgb5MZ9wlmnC79arQAN1ytP53idh1X/j5AW/w8wMOHRzUowuUJu4ifGkMADMAzAAwA8AMADMAzAAwA8AMADMAzAAwA8AMACvdH+Dzv+QEwAwAMwDMADADwAwAMwDMADADwAwAMwDMADADwAwAMwDsH5fw4xGXqkx/AAAAAElFTkSuQmCC';

const PREVIEW_MODAL_SELECTOR = [
    '.file-preview-modal',
    '.modal-image.in',
    '.modal-image.show',
    '#viewImageModalLabel',
].join(', ');

const LOADED_IMAGE_SELECTOR = [
    '.post-image img:not(.image-loading__placeholder)',
    '.post--attachment img:not(.image-loading__placeholder)',
    'img[src*="/api/v4/files/"]:not(.image-loading__placeholder)',
].join(', ');

const PREVIEW_FILE_NAME = 'e2e-preview.png';

// Shared helpers injected into renderer scripts (same pattern as DOM_UTILS in serverView.ts).
const PREVIEW_IMAGE_UTILS = `
const LOADED_IMAGE_SELECTOR = ${JSON.stringify(LOADED_IMAGE_SELECTOR)};
const PREVIEW_FILE_NAME = ${JSON.stringify(PREVIEW_FILE_NAME)};
const isPreviewControlVisible = (el) => el instanceof HTMLElement && window.getComputedStyle(el).display !== 'none';
const isLoadedPreviewImage = (el) => el instanceof HTMLImageElement &&
    !el.classList.contains('image-loading__placeholder') &&
    el.complete &&
    el.naturalWidth > 0 &&
    isPreviewControlVisible(el);
const postHasPreviewFixture = (post) => {
    if (post.querySelector('[aria-label*="' + PREVIEW_FILE_NAME + '" i]')) {
        return true;
    }
    // Filename can also appear in attachment headers before the image aria-label mounts.
    const attachment = post.querySelector('.post-image, .post--attachment, .file-attachment, .file-preview__button');
    return Boolean(attachment && (attachment.textContent || '').toLowerCase().includes(PREVIEW_FILE_NAME));
};
const findPreviewFixturePost = () => {
    const posts = Array.from(document.querySelectorAll('.post'));
    for (let index = posts.length - 1; index >= 0; index--) {
        const post = posts[index];
        if (postHasPreviewFixture(post)) {
            return post;
        }
    }
    return null;
};
const findVisibleLoadedPreviewButton = (root) => {
    for (const button of root.querySelectorAll('.file-preview__button')) {
        if (!isPreviewControlVisible(button)) {
            continue;
        }
        const loadedImg = button.querySelector('img:not(.image-loading__placeholder)');
        if (loadedImg instanceof HTMLImageElement && loadedImg.complete && loadedImg.naturalWidth > 0) {
            return button;
        }
    }
    return null;
};
`;

/**
 * Mattermost 11.10+ (MM-69174) SizeAwareImage ignores clicks until the real image has
 * loaded, and keeps a visible placeholder button while the clickable control is
 * display:none. Wait for a visible, loaded non-placeholder control before opening.
 */
async function waitForLoadedImagePreviewControl(serverWin: ServerView): Promise<void> {
    await expect.poll(async () => serverWin.runInRenderer<boolean>(`
        ${PREVIEW_IMAGE_UTILS}
        const post = findPreviewFixturePost();
        if (!post) {
            return false;
        }

        const previewButton = findVisibleLoadedPreviewButton(post);
        if (previewButton) {
            previewButton.scrollIntoView({block: 'center'});
            return true;
        }

        // Legacy servers without .file-preview__button
        const legacyImg = post.querySelector(LOADED_IMAGE_SELECTOR);
        if (isLoadedPreviewImage(legacyImg)) {
            legacyImg.scrollIntoView({block: 'center'});
            return true;
        }
        return false;
    `, true), {
        timeout: 60_000,
        message: 'Uploaded e2e-preview.png must finish loading into a visible file-preview control before it can be opened',
    }).toBe(true);
}

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
        ${PREVIEW_IMAGE_UTILS}
        const composer = document.querySelector('#post-create, .AdvancedTextEditor, .post-create, [data-testid="post-create"]');
        const draftAttachment = composer?.querySelector('.file-preview, .file-preview__container, .attachment-preview');
        if (draftAttachment) {
            return false;
        }

        const post = findPreviewFixturePost();
        if (!post) {
            return false;
        }
        post.scrollIntoView({block: 'center'});
        return true;
    `, true), {timeout: 60_000, message: 'Uploaded e2e-preview.png must appear in the channel post list'}).toBe(true);
}

async function uploadAndPostPng(serverWin: ServerView): Promise<void> {
    const uploaded = await serverWin.runInRenderer<boolean>(`
        const pngBase64 = ${JSON.stringify(PREVIEW_PNG_BASE64)};
        const binary = atob(pngBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], ${JSON.stringify(PREVIEW_FILE_NAME)}, {type: 'image/png'});

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
    await waitForLoadedImagePreviewControl(serverWin);
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
        ${PREVIEW_IMAGE_UTILS}
        const root = findPreviewFixturePost();
        if (!root) {
            return false;
        }

        // Mattermost 11.11 dropped onClick from the .file-preview__button wrapper.
        // SizeAwareImage handles clicks on the loaded <img> only (and ignores
        // them until load — MM-69174). Clicking the wrapper is a no-op.
        const previewButton = findVisibleLoadedPreviewButton(root);
        const loadedImg = previewButton?.querySelector('img:not(.image-loading__placeholder)');
        const clickTargets = [
            isLoadedPreviewImage(loadedImg) ? loadedImg : null,
            ...Array.from(root.querySelectorAll('[aria-label*="' + PREVIEW_FILE_NAME + '" i]')),
            ...Array.from(root.querySelectorAll(LOADED_IMAGE_SELECTOR)),
            root.querySelector('.post-image__thumbnail'),
            root.querySelector('.post-image .image-loaded-container'),
            root.querySelector('.post-image .small-image__container'),
            root.querySelector('.post-image__image'),
            root.querySelector('.file-viewer-touch'),
        ].filter((target) => {
            if (!target) {
                return false;
            }
            if (target instanceof HTMLImageElement) {
                return isLoadedPreviewImage(target);
            }
            return isPreviewControlVisible(target) &&
                Boolean(target.querySelector?.('img:not(.image-loading__placeholder)'));
        });

        const target = clickTargets[0];
        if (!(target instanceof HTMLElement)) {
            return false;
        }

        target.scrollIntoView({block: 'center', inline: 'center'});
        target.focus?.();
        target.click();
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
            document.querySelector('.post-image img[src*="/files/"]:not(.image-loading__placeholder)')?.getAttribute('src'),
            document.querySelector('img[src*="/api/v4/files/"]:not(.image-loading__placeholder)')?.getAttribute('src'),
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
