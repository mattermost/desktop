// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';

// All welcome screen tests need a no-servers app. This helper launches one.
async function launchEmptyApp(testInfo: {outputDir: string; title: string}) {
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

async function getCurrentSlideTitle(modal: any) {
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
            let app;
            let modal;
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
                await app?.close().catch(() => {});
                if (userDataDir) {
                    await waitForLockFileRelease(userDataDir).catch(() => {});
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
            let app;
            let modal;
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
                await app?.close().catch(() => {});
                if (userDataDir) {
                    await waitForLockFileRelease(userDataDir).catch(() => {});
                }
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
                ({app, modal, userDataDir} = await launchEmptyApp(testInfo));
                await modal.click('#getStartedWelcomeScreen');
                await modal.waitForSelector('#input_name', {timeout: 10_000});
                await modal.waitForSelector('#input_url', {timeout: 10_000});
            } finally {
                await app?.close().catch(() => {});
                if (userDataDir) {
                    await waitForLockFileRelease(userDataDir).catch(() => {});
                }
                await releaseLock();
            }
        },
    );
});
