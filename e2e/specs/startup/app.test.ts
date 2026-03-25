// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {electronBinaryPath, appDir, demoConfig, emptyConfig, writeConfigFile} from '../../helpers/config';
import {acquireExclusiveLock} from '../../helpers/exclusiveLock';

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
                await firstApp.close().catch(() => {});
                await waitForLockFileRelease(userDataDir);
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
            let userDataDir = '';

            try {
            // This test needs a no-servers config. Override before launch.
            // Since electronApp fixture has already launched with demoConfig,
            // we test this by launching a fresh app with emptyConfig.
            // NOTE: In Phase 3, refactor fixture to accept config override.
            // For now, use a nested launch scoped to this test.
                userDataDir = testInfo.outputDir + '/empty-userdata';
                const {mkdirSync} = await import('fs');
                mkdirSync(userDataDir, {recursive: true});
                writeConfigFile(userDataDir, emptyConfig);

                emptyApp = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                    env: {...process.env, NODE_ENV: 'test'},
                    timeout: 60_000,
                });

                let welcomeModal = emptyApp.windows().find((w) => w.url().includes('welcomeScreen'));
                if (!welcomeModal) {
                    welcomeModal = await emptyApp.waitForEvent('window', {
                        predicate: (w) => w.url().includes('welcomeScreen'),
                        timeout: 15_000,
                    });
                }
                await welcomeModal.waitForLoadState('domcontentloaded');
                const text = await welcomeModal.innerText('.WelcomeScreen .WelcomeScreen__button');
                expect(text).toBe('Get Started');
            } finally {
                await emptyApp?.close().catch(() => {});
                if (userDataDir) {
                    await waitForLockFileRelease(userDataDir).catch(() => {});
                }
                await releaseLock();
            }
        },
    );

    test(
        'MM-T4985 should show app name in title bar when no servers exist',
        {tag: ['@P2', '@darwin', '@win32']}, // skipped on Linux
        async ({}, testInfo) => {
            if (process.platform === 'linux') {
                test.skip(true, 'Linux not supported');
                return;
            }
            const releaseLock = await acquireExclusiveLock('startup-empty-app');
            let emptyApp;
            let userDataDir = '';

            try {
                userDataDir = testInfo.outputDir + '/empty-title-userdata';
                const {mkdirSync} = await import('fs');
                mkdirSync(userDataDir, {recursive: true});
                writeConfigFile(userDataDir, emptyConfig);

                emptyApp = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                    env: {...process.env, NODE_ENV: 'test'},
                    timeout: 60_000,
                });

                await waitForAppReady(emptyApp);
                const mainWin = emptyApp.windows().find((w) => w.url().includes('index'));
                expect(mainWin).toBeDefined();
                const runtimeAppName = await emptyApp.evaluate(({app}) => app.getName());
                await expect.poll(
                    async () => mainWin!.innerText('.app-title'),
                    {timeout: 10_000},
                ).toBe(runtimeAppName);
            } finally {
                await emptyApp?.close().catch(() => {});
                if (userDataDir) {
                    await waitForLockFileRelease(userDataDir).catch(() => {});
                }
                await releaseLock();
            }
        },
    );
});
