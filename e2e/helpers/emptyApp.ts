// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mkdirSync} from 'fs';

import {expect} from '@playwright/test';
import type {ElectronApplication, Page} from 'playwright';
import {_electron as electron} from 'playwright';

import {waitForAppReady} from './appReadiness';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from './config';

async function waitForWelcomeScreen(app: ElectronApplication): Promise<Page> {
    let welcomeScreen: Page | undefined;
    await expect.poll(async () => {
        welcomeScreen = app.windows().find((w) => w.url().includes('welcomeScreen'));
        return welcomeScreen;
    }, {timeout: 15_000, message: 'Welcome screen window must appear'}).toBeTruthy();
    return welcomeScreen!;
}

export async function launchEmptyApp(
    testInfo: {outputDir: string},
    userDataSubdir = 'empty-userdata',
): Promise<{app: ElectronApplication; welcomeScreen: Page; userDataDir: string}> {
    const userDataDir = `${testInfo.outputDir}/${userDataSubdir}`;
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, emptyConfig);

    let app: ElectronApplication | undefined;
    try {
        app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });
        await waitForAppReady(app);

        const welcomeScreen = await waitForWelcomeScreen(app);
        await welcomeScreen.waitForLoadState('domcontentloaded');
        return {app, welcomeScreen, userDataDir};
    } catch (error) {
        if (app) {
            await app.close().catch(() => undefined);
        }
        throw error;
    }
}
