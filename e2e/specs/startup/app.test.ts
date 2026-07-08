// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, writeConfigFile} from '../../helpers/config';
import {closeAppSafely, closeElectronApp} from '../../helpers/electronApp';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';
import {launchEmptyApp} from '../../helpers/emptyApp';

test.describe('startup/app', () => {
    test.describe.configure({mode: 'serial'});

    test(
        'MM-T4400 should be stopped when the app instance already exists',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            const userDataDir = testInfo.outputDir + '/singleton-userdata';
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, demoConfig);

            // Launch first app to hold the singleton lock
            const firstApp = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test', MM_E2E_USE_SINGLE_INSTANCE_LOCK: 'true'},
                timeout: 60_000,
            });

            let secondLaunchSucceeded = false;
            let secondApp;
            try {
                // Wait for full init so requestSingleInstanceLock() is definitely held
                await waitForAppReady(firstApp);

                try {
                    secondApp = await electron.launch({
                        executablePath: electronBinaryPath,
                        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                        env: {...process.env, NODE_ENV: 'test', MM_E2E_USE_SINGLE_INSTANCE_LOCK: 'true'},
                        timeout: 5_000, // short — second instance should exit immediately
                    });
                    secondLaunchSucceeded = true;
                } catch {
                    // Expected: second instance exits when it can't acquire the singleton lock
                } finally {
                    if (secondApp) {
                        await secondApp.close().catch(() => {});
                    }
                }
            } finally {
                await closeElectronApp(firstApp, userDataDir);
            }

            expect(secondLaunchSucceeded, 'Second app instance should not have launched successfully').toBe(false);
        },
    );

    test(
        'MM-T4975 should show the welcome screen modal when no servers exist',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let emptyApp;
            let welcomeScreen;
            let userDataDir = '';

            try {
                ({app: emptyApp, welcomeScreen, userDataDir} = await launchEmptyApp(testInfo, 'empty-userdata'));
                const text = await welcomeScreen.innerText('.WelcomeScreen .WelcomeScreen__button');
                expect(text).toBe('Get started');
            } finally {
                await closeAppSafely(emptyApp, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4985 should show app name in title bar when no servers exist',
        {tag: ['@P2', '@darwin', '@win32']}, // skipped on Linux
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let emptyApp;
            let userDataDir = '';

            try {
                ({app: emptyApp, userDataDir} = await launchEmptyApp(testInfo, 'empty-title-userdata'));
                const mainWin = emptyApp.windows().find((w) => w.url().includes('index'));
                expect(mainWin).toBeDefined();
                const runtimeAppName = await emptyApp.evaluate(({app}) => app.getName());
                await expect.poll(
                    async () => mainWin!.innerText('.app-title'),
                    {timeout: 10_000},
                ).toBe(runtimeAppName);
            } finally {
                await closeAppSafely(emptyApp, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4399 New Server Modal should appear when no servers exist',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let emptyApp;
            let welcomeScreen;
            let userDataDir = '';

            try {
                ({app: emptyApp, welcomeScreen, userDataDir} = await launchEmptyApp(testInfo, 'empty-noservers-userdata'));
                await welcomeScreen.click('#getStartedWelcomeScreen');
                await welcomeScreen.waitForSelector('#input_url', {timeout: 10_000});
                await welcomeScreen.waitForSelector('#input_name', {timeout: 10_000});

                expect(await welcomeScreen.isVisible('#input_url'), 'Server URL input must be visible').toBe(true);
                expect(await welcomeScreen.isVisible('#input_name'), 'Server name input must be visible').toBe(true);
            } finally {
                await closeAppSafely(emptyApp, userDataDir);
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4419 Add Server Modal should not be removable when no servers exist',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let emptyApp;
            let welcomeScreen;
            let userDataDir = '';

            try {
                ({app: emptyApp, welcomeScreen, userDataDir} = await launchEmptyApp(testInfo, 'empty-modal-lock-userdata'));
                await welcomeScreen.waitForSelector('.WelcomeScreen', {timeout: 15_000});
                await welcomeScreen.keyboard.press('Escape');

                expect(
                    await welcomeScreen.isVisible('.WelcomeScreen'),
                    'Welcome screen modal must remain visible after Escape when no servers exist',
                ).toBe(true);
            } finally {
                await closeAppSafely(emptyApp, userDataDir);
                await releaseLock();
            }
        },
    );
});
