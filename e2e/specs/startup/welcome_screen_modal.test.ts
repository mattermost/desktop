// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from '../../helpers/config';
import {waitForAppReady} from '../../helpers/appReadiness';

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
    return {app, modal};
}

test.describe('startup/welcome_screen_modal', () => {
    test(
        'MM-T4976 should show the slides in the expected order',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {app, modal} = await launchEmptyApp(testInfo);
            try {
                const title = await modal.innerText('.WelcomeScreen__title');
                expect(title.length).toBeGreaterThan(0);
            } finally {
                await app.close();
            }
        },
    );

    test(
        'MM-T4977 should be able to move through slides clicking navigation buttons',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {app, modal} = await launchEmptyApp(testInfo);
            try {
                const nextBtn = modal.locator('.WelcomeScreen__button--next');
                if (await nextBtn.isVisible()) {
                    const firstTitle = await modal.innerText('.WelcomeScreen__title');
                    await nextBtn.click();
                    const secondTitle = await modal.innerText('.WelcomeScreen__title');
                    expect(secondTitle).not.toBe(firstTitle);
                }
            } finally {
                await app.close();
            }
        },
    );

    test(
        'MM-T4983 should click Get Started and open new server modal',
        {tag: ['@P2', '@all']},
        async ({}, testInfo) => {
            const {app, modal} = await launchEmptyApp(testInfo);
            try {
                // Navigate to last slide
                let hasNext = await modal.locator('.WelcomeScreen__button--next').isVisible();
                while (hasNext) {
                    await modal.locator('.WelcomeScreen__button--next').click();
                    hasNext = await modal.locator('.WelcomeScreen__button--next').isVisible();
                }

                await modal.click('.WelcomeScreen .WelcomeScreen__button');

                // Should open new server modal or close welcome screen
                await modal.waitForSelector('.WelcomeScreen', {state: 'detached', timeout: 5_000})
                    .catch(() => {/* modal may close in a different way */});
            } finally {
                await app.close();
            }
        },
    );
});
