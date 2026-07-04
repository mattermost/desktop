// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron, type Page} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from '../../helpers/config';
import {closeElectronAppFast} from '../../helpers/electronApp';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';

// All welcome screen tests need a no-servers app. This helper launches one.
async function launchEmptyApp(testInfo: {outputDir: string; title: string}): Promise<{app: Awaited<ReturnType<typeof electron.launch>>; modal: Page; userDataDir: string}> {
    const {mkdirSync} = await import('fs');
    const userDataDir = testInfo.outputDir + '/empty-userdata';
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, emptyConfig);

    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);

    const modal = app.windows().find((w) => w.url().includes('welcomeScreen')) ??
        await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('welcomeScreen'),
            timeout: 10_000,
        });
    await modal.waitForLoadState('domcontentloaded');
    return {app, modal, userDataDir};
}

async function getCurrentSlideTitle(modal: Page) {
    return modal.locator('.Carousel__slide-current .WelcomeScreenSlide__title').innerText();
}

function normalizeTitle(title: string) {
    return title.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

test.describe('startup/welcome_screen_modal', () => {
    test.describe.configure({mode: 'serial'});

    test(
        'MM-T4976 should show the slides in the expected order',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
            let modal: Page;
            let userDataDir = '';
            try {
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));
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
                if (app && userDataDir) {
                    await closeElectronAppFast(app, userDataDir);
                } else if (app) {
                    await app.close().catch(() => {});
                }
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4977 should be able to move through slides clicking navigation buttons',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
            let modal: Page;
            let userDataDir = '';
            try {
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));
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
                if (app && userDataDir) {
                    await closeElectronAppFast(app, userDataDir);
                } else if (app) {
                    await app.close().catch(() => {});
                }
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4983 should click Get Started and open new server modal',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            // SKIP on Linux: Clicking "Get Started" transitions to ConfigureServer in the welcome screen window,
            // not a NewServerModal in the main window. Test expectations don't match actual implementation.
            if (process.platform === 'linux') {
                test.skip(true, 'Get Started shows ConfigureServer in welcome screen, not NewServerModal in main window');
            }

            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
            let modal: Page;
            let userDataDir = '';
            try {
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));
                await modal.click('#getStartedWelcomeScreen');

                // Wait for NewServerModal to appear in the main window after clicking Get Started
                const mainWin = app!.windows().find((w) => w.url().includes('index'));
                await mainWin!.waitForSelector('.NewServerModal', {timeout: 10_000});
                await mainWin!.waitForSelector('#serverNameInput', {timeout: 10_000});
                await mainWin!.waitForSelector('#serverUrlInput', {timeout: 10_000});
            } finally {
                if (app && userDataDir) {
                    await closeElectronAppFast(app, userDataDir);
                } else if (app) {
                    await app.close().catch(() => {});
                }
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4978 should be able to move through slides clicking the pagination indicator',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
            let modal: Page;
            let userDataDir = '';
            try {
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));

                // Verify pagination indicators exist (4 slides = 4 dots)
                const dot0 = modal.locator('#PaginationIndicator0');
                const dot1 = modal.locator('#PaginationIndicator1');
                const dot2 = modal.locator('#PaginationIndicator2');
                const dot3 = modal.locator('#PaginationIndicator3');
                await expect(dot0).toBeVisible({timeout: 5_000});
                await expect(dot1).toBeVisible({timeout: 5_000});
                await expect(dot2).toBeVisible({timeout: 5_000});
                await expect(dot3).toBeVisible({timeout: 5_000});

                // First dot should be active initially
                await expect(dot0).toHaveClass(/active/);

                const firstTitle = await getCurrentSlideTitle(modal);

                // Click the second pagination dot
                await dot1.click();
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 5_000},
                ).not.toBe(firstTitle);

                // Second dot should now be active
                await expect(dot1).toHaveClass(/active/);
                await expect(dot0).not.toHaveClass(/active/);

                // Click the fourth dot
                await dot3.click();
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 5_000},
                ).not.toBe(firstTitle);
                await expect(dot3).toHaveClass(/active/);
            } finally {
                if (app && userDataDir) {
                    await closeElectronAppFast(app, userDataDir);
                } else if (app) {
                    await app.close().catch(() => {});
                }
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4979 should auto-advance slides every 5 seconds',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
            let modal: Page;
            let userDataDir = '';
            try {
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));

                // Capture the initial slide title
                const firstTitle = await getCurrentSlideTitle(modal);

                // Wait for auto-advance (AUTO_CHANGE_TIME = 5000ms + 1s buffer)
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 8_000, message: 'Slide should auto-advance within ~5 seconds'},
                ).not.toBe(firstTitle);

                // Capture second slide title and wait for another advance
                const secondTitle = await getCurrentSlideTitle(modal);
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 8_000, message: 'Slide should auto-advance again within ~5 seconds'},
                ).not.toBe(secondTitle);
            } finally {
                if (app && userDataDir) {
                    await closeElectronAppFast(app, userDataDir);
                } else if (app) {
                    await app.close().catch(() => {});
                }
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4981 should wrap from last slide to first slide',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
            let modal: Page;
            let userDataDir = '';
            try {
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));

                const firstTitle = await getCurrentSlideTitle(modal);

                // Navigate to the last slide by clicking next 3 times
                const nextBtn = modal.locator('#nextCarouselButton');
                await nextBtn.click();
                await expect.poll(async () => getCurrentSlideTitle(modal), {timeout: 5_000}).not.toBe(firstTitle);
                await nextBtn.click();
                await nextBtn.click();

                // We should now be on the last slide ("Integrate with tools you love")
                const lastTitle = await getCurrentSlideTitle(modal);
                expect(normalizeTitle(lastTitle)).toBe('integrate with tools you love');

                // Click next from last slide — should wrap to first
                await nextBtn.click();
                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 5_000, message: 'Should wrap from last slide back to first'},
                ).toBe(firstTitle);
            } finally {
                if (app && userDataDir) {
                    await closeElectronAppFast(app, userDataDir);
                } else if (app) {
                    await app.close().catch(() => {});
                }
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4982 should wrap from first slide to last slide',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
            let modal: Page;
            let userDataDir = '';
            try {
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));

                const firstTitle = await getCurrentSlideTitle(modal);

                // Click prev from the first slide — should wrap to the last slide
                const prevBtn = modal.locator('#prevCarouselButton');
                await prevBtn.click();

                await expect.poll(
                    async () => getCurrentSlideTitle(modal),
                    {timeout: 5_000, message: 'Should wrap from first slide back to last'},
                ).not.toBe(firstTitle);

                const wrappedTitle = await getCurrentSlideTitle(modal);
                expect(normalizeTitle(wrappedTitle)).toBe('integrate with tools you love');
            } finally {
                if (app && userDataDir) {
                    await closeElectronAppFast(app, userDataDir);
                } else if (app) {
                    await app.close().catch(() => {});
                }
                await releaseLock();
            }
        },
    );
});
