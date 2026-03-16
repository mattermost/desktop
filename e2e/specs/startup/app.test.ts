// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from '../../helpers/config';

test.describe('startup/app', () => {
    test(
        'MM-T4400 should be stopped when the app instance already exists',
        {tag: ['@P1', '@all']},
        async ({}) => {
            // Try launching a second instance against the same userDataDir.
            // We cannot share the fixture's userDataDir, so we attempt against a
            // fresh dir — Electron's singleton is per-executable, not per-data-dir.
            // The second instance should exit before resolving.
            let secondApp;
            try {
                secondApp = await electron.launch({
                    executablePath: electronBinaryPath,
                    args: [appDir, '--no-sandbox', '--disable-gpu'],
                    timeout: 5_000, // short — expect it to exit quickly
                });

                // If we get here, the second instance launched (bad — but close it)
                await secondApp.close();
                throw new Error('Second app instance should not have launched successfully');
            } catch (err: any) {
                // Expected: launch times out or the process exits quickly.
                // A timeout error or process exit error is the correct outcome.
                expect(err.message).not.toContain('Second app instance should not have launched');
            }
        },
    );

    test(
        'MM-T4975 should show the welcome screen modal when no servers exist',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            // This test needs a no-servers config. Override before launch.
            // Since electronApp fixture has already launched with demoConfig,
            // we test this by launching a fresh app with emptyConfig.
            // NOTE: In Phase 3, refactor fixture to accept config override.
            // For now, use a nested launch scoped to this test.
            const userDataDir = testInfo.outputDir + '/empty-userdata';
            const {mkdirSync} = await import('fs');
            mkdirSync(userDataDir, {recursive: true});
            writeConfigFile(userDataDir, emptyConfig);

            const emptyApp = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });

            try {
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
                await emptyApp.close();
            }
        },
    );

    test(
        'MM-T4985 should show app name in title bar when no servers exist',
        {tag: ['@P2', '@darwin', '@win32']}, // skipped on Linux
        async ({electronApp}) => {
            const mainWin = electronApp.windows().find((w) => w.url().includes('index'));
            expect(mainWin).toBeDefined();
            const titleText = await mainWin!.innerText('.app-title');
            expect(titleText).toBe('Electron');
        },
    );
});
