// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig, writeConfigFile} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

test(
    'session is preserved across app restart — no re-login required',
    {tag: ['@P0', '@all']},
    async ({}, testInfo) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL not set');
            return;
        }

        const {mkdirSync} = await import('fs');
        const userDataDir = path.join(testInfo.outputDir, 'persistent-userdata');
        mkdirSync(userDataDir, {recursive: true});
        writeConfigFile(userDataDir, demoMattermostConfig);

        // --- First launch: log in ---
        const app1 = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 90_000,
        });

        try {
            await waitForAppReady(app1);
            const serverMap1 = await buildServerMap(app1);
            const serverWin1 = serverMap1.example?.[0]?.win;
            expect(serverWin1).toBeDefined();

            // Log in
            await loginToMattermost(serverWin1!);

            // Verify we reached the app (not login page)
            await serverWin1!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
        } finally {
            await app1.close();
            await waitForLockFileRelease(userDataDir);
        }

        // --- Second launch: should NOT show login page ---
        const app2 = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 90_000,
        });

        try {
            await waitForAppReady(app2);
            const serverMap2 = await buildServerMap(app2);
            const serverWin2 = serverMap2.example?.[0]?.win;
            expect(serverWin2).toBeDefined();

            // Login page should NOT appear
            const loginVisible = await serverWin2!.locator('#input_loginId').isVisible().catch(() => false);
            expect(loginVisible).toBe(false);

            // App channel should be visible
            await serverWin2!.waitForSelector('#sidebarItem_town-square', {timeout: 30_000});
        } finally {
            await app2.close();
            await waitForLockFileRelease(userDataDir);
        }
    },
);
