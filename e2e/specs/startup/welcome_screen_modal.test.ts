// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '../../fixtures/index';
import {closeAppSafely} from '../../helpers/electronApp';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {launchEmptyApp} from '../../helpers/emptyApp';

async function getCurrentSlideTitle(modal: any) {
    return modal.locator('.Carousel__slide-current .WelcomeScreenSlide__title').innerText();
}

function normalizeTitle(title: string) {
    return title.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

test.describe('startup/welcome_screen_modal', () => {
    test.describe.configure({mode: 'serial'});

    test(
        'MM-T4976 MM-T4980 should show the slides in the expected order',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app;
            let modal;
            let userDataDir = '';
            try {
                ({app, welcomeScreen: modal, userDataDir} = await launchEmptyApp(testInfo));
                const titles = [await getCurrentSlideTitle(modal)];

                for (let i = 0; i < 3; i++) {
                    await modal.click('#nextCarouselButton');
                    titles.push(await getCurrentSlideTitle(modal));
                }

                expect(titles.map(normalizeTitle)).toEqual([
                    'welcome',
                    'collaborate in real time',
                    'start secure calls instantly',
                    'integrate with tools you love',
                ]);
            } finally {
                await closeAppSafely(app, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4977 should be able to move through slides clicking navigation buttons',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app;
            let modal;
            let userDataDir = '';
            try {
                ({app, welcomeScreen: modal, userDataDir} = await launchEmptyApp(testInfo));
                const nextBtn = modal.locator('#nextCarouselButton');
                const prevBtn = modal.locator('#prevCarouselButton');
                await expect(nextBtn).toBeVisible({timeout: 10_000});
                const firstTitle = await getCurrentSlideTitle(modal);
                await nextBtn.click();
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 10_000},
                ).not.toBe(firstTitle);
                const secondTitle = await getCurrentSlideTitle(modal);
                expect(secondTitle).not.toBe(firstTitle);
                await prevBtn.click();
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 10_000},
                ).toBe(firstTitle);
            } finally {
                await closeAppSafely(app, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4983 should click Get Started and open new server modal',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app;
            let modal;
            let userDataDir = '';
            try {
                ({app, welcomeScreen: modal, userDataDir} = await launchEmptyApp(testInfo));
                await modal.click('#getStartedWelcomeScreen');
                await modal.waitForSelector('#input_name', {timeout: 10_000});
                await modal.waitForSelector('#input_url', {timeout: 10_000});
            } finally {
                await closeAppSafely(app, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4978 should be able to move through slides clicking the pagination indicator',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app;
            let modal;
            let userDataDir = '';
            try {
                ({app, welcomeScreen: modal, userDataDir} = await launchEmptyApp(testInfo));

                const dot0 = modal.locator('#PaginationIndicator0');
                const dot1 = modal.locator('#PaginationIndicator1');
                const dot2 = modal.locator('#PaginationIndicator2');
                const dot3 = modal.locator('#PaginationIndicator3');
                await expect(dot0).toBeVisible({timeout: 5_000});
                await expect(dot1).toBeVisible({timeout: 5_000});
                await expect(dot2).toBeVisible({timeout: 5_000});
                await expect(dot3).toBeVisible({timeout: 5_000});
                await expect(dot0).toHaveClass(/active/);

                const firstTitle = await getCurrentSlideTitle(modal);
                await dot1.click();
                await expect.poll(async () => getCurrentSlideTitle(modal), {timeout: 5_000}).not.toBe(firstTitle);
                await expect(dot1).toHaveClass(/active/);
                await expect(dot0).not.toHaveClass(/active/);

                await dot3.click();
                await expect.poll(async () => getCurrentSlideTitle(modal), {timeout: 5_000}).not.toBe(firstTitle);
                await expect(dot3).toHaveClass(/active/);
            } finally {
                await closeAppSafely(app, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4979 should auto-advance slides every 5 seconds',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app;
            let modal;
            let userDataDir = '';
            try {
                ({app, welcomeScreen: modal, userDataDir} = await launchEmptyApp(testInfo));

                const firstTitle = await getCurrentSlideTitle(modal);
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 8_000, message: 'Slide should auto-advance within ~5 seconds'},
                ).not.toBe(firstTitle);

                const secondTitle = await getCurrentSlideTitle(modal);
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 8_000, message: 'Slide should auto-advance again within ~5 seconds'},
                ).not.toBe(secondTitle);
            } finally {
                await closeAppSafely(app, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4981 should wrap from last slide to first slide',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app;
            let modal;
            let userDataDir = '';
            try {
                ({app, welcomeScreen: modal, userDataDir} = await launchEmptyApp(testInfo));

                const firstTitle = await getCurrentSlideTitle(modal);
                const nextBtn = modal.locator('#nextCarouselButton');
                await nextBtn.click();
                await expect.poll(async () => getCurrentSlideTitle(modal), {timeout: 5_000}).not.toBe(firstTitle);
                await nextBtn.click();
                await nextBtn.click();

                const lastTitle = await getCurrentSlideTitle(modal);
                expect(normalizeTitle(lastTitle)).toBe('integrate with tools you love');

                await nextBtn.click();
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 5_000, message: 'Should wrap from last slide back to first'},
                ).toBe(firstTitle);
            } finally {
                await closeAppSafely(app, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4982 should wrap from first slide to last slide',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app;
            let modal;
            let userDataDir = '';
            try {
                ({app, welcomeScreen: modal, userDataDir} = await launchEmptyApp(testInfo));

                const firstTitle = await getCurrentSlideTitle(modal);
                const prevBtn = modal.locator('#prevCarouselButton');
                await prevBtn.click();

                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 5_000, message: 'Should wrap from first slide back to last'},
                ).not.toBe(firstTitle);

                const wrappedTitle = await getCurrentSlideTitle(modal);
                expect(normalizeTitle(wrappedTitle)).toBe('integrate with tools you love');
            } finally {
                await closeAppSafely(app, userDataDir);
                await releaseLock();
            }
        },
    );
});
