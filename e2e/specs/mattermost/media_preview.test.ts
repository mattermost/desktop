// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {typeIntoPostTextbox, waitForMattermostShellReady} from '../../helpers/mattermostShell';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import type {ServerView} from '../../helpers/serverView';

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function uploadPngAttachment(serverWin: ServerView): Promise<void> {
    const uploaded = await serverWin.runInRenderer<boolean>(`
        const pngBase64 = ${JSON.stringify(TINY_PNG_BASE64)};
        const binary = atob(pngBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], 'e2e-preview.png', {type: 'image/png'});

        const attachButton = document.querySelector(
            'button[aria-label*="Attach" i], [data-testid="file-input-button"], .AdvancedTextEditor__action-button[aria-label*="Attach" i]',
        );
        attachButton?.click();

        const input = document.querySelector('#fileUploadInput, input[type="file"]');
        if (!input) {
            return false;
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
        return true;
    `, true);
    expect(uploaded, 'Image upload input must accept a PNG attachment').toBe(true);
}

async function openImagePreview(serverWin: ServerView): Promise<boolean> {
    return serverWin.runInRenderer<boolean>(`
        const thumbnail = document.querySelector(
            '.post-image__image, .file-preview__thumbnail, .image-loaded-container img, .post-image img',
        );
        thumbnail?.click();
        return Boolean(
            document.querySelector('#imagePreview, .image-preview, .file-preview-modal, [class*="ImagePreview"]'),
        );
    `, true);
}

async function closeImagePreview(serverWin: ServerView): Promise<boolean> {
    return serverWin.runInRenderer<boolean>(`
        const closeButton = document.querySelector(
            '#imagePreview .modal-header-close, .image-preview .close, .file-preview-modal button[aria-label="Close"], [class*="ImagePreview"] button[aria-label="Close"]',
        );
        closeButton?.click();
        return !Boolean(
            document.querySelector('#imagePreview, .image-preview, .file-preview-modal, [class*="ImagePreview"]'),
        );
    `, true);
}

async function copyPublicLinkFromPreview(serverWin: ServerView): Promise<string | null> {
    return serverWin.runInRenderer<string | null>(`
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const getPublicLinkButton = buttons.find((element) => {
            const text = (element.textContent ?? '').trim().toLowerCase();
            return text.includes('public link') || text.includes('get link');
        });
        getPublicLinkButton?.click();

        const linkInput = document.querySelector(
            'input[readonly][value*="http"], input[value*="/files/"], .public-link-input input',
        );
        if (linkInput instanceof HTMLInputElement && linkInput.value) {
            return linkInput.value;
        }

        const copied = document.querySelector('[data-testid="publicLink"], .public-link__input');
        if (copied instanceof HTMLInputElement && copied.value) {
            return copied.value;
        }

        return null;
    `, true);
}

async function openPreviewFromPostedLink(serverWin: ServerView, publicLink: string): Promise<boolean> {
    return serverWin.runInRenderer<boolean>(`
        const targetLink = ${JSON.stringify(publicLink)};
        const link = Array.from(document.querySelectorAll('a')).find((anchor) => {
            const href = anchor.getAttribute('href') ?? '';
            const text = anchor.textContent ?? '';
            return href.includes('/files/') || href === targetLink || text.includes(targetLink);
        });
        link?.click();
        return Boolean(
            document.querySelector('#imagePreview, .image-preview, .file-preview-modal, [class*="ImagePreview"]'),
        );
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

            const serverEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
            expect(serverEntry?.win, 'Mattermost server view should exist').toBeTruthy();
            const serverWin = serverEntry!.win;

            await prepareMattermostServerView(electronApp, serverEntry!.webContentsId);
            await loginToMattermost(serverWin);
            await waitForMattermostShellReady(serverWin, {channelItem: '#sidebarItem_town-square'});
            await serverWin.click('#sidebarItem_town-square');

            await uploadPngAttachment(serverWin);

            await expect.poll(async () => serverWin.runInRenderer<boolean>(`
                return Boolean(
                    document.querySelector('.post-image, .file-preview, .post--attachment, .image-loaded-container'),
                );
            `, true), {timeout: 30_000, message: 'Uploaded image post must appear in channel'}).toBe(true);

            expect(await openImagePreview(serverWin), 'Image preview must open after clicking the uploaded image').toBe(true);

            const publicLink = await copyPublicLinkFromPreview(serverWin);
            if (!publicLink) {
                test.skip(true, 'Public link UI is unavailable on this server/webapp version');
                return;
            }

            expect(await closeImagePreview(serverWin), 'Image preview must close from the preview modal').toBe(true);

            await typeIntoPostTextbox(serverWin, publicLink);
            await serverWin.keyboard.press('Enter');

            await expect.poll(
                () => openPreviewFromPostedLink(serverWin, publicLink),
                {timeout: 20_000, message: 'Permanent link must reopen the image preview'},
            ).toBe(true);

            expect(await closeImagePreview(serverWin), 'Image preview must close when clicking the X button').toBe(true);
        },
    );
});
