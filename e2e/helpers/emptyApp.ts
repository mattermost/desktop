// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication, Page} from 'playwright';
import {_electron as electron} from 'playwright';

import {waitForAppReady} from './appReadiness';
import {electronBinaryPath, appDir, emptyConfig, writeConfigFile} from './config';

export async function launchEmptyApp(
    testInfo: {outputDir: string},
    userDataSubdir = 'empty-userdata',
): Promise<{app: ElectronApplication; welcomeScreen: Page; userDataDir: string}> {
    const {mkdirSync} = await import('fs');
    const userDataDir = `${testInfo.outputDir}/${userDataSubdir}`;
    mkdirSync(userDataDir, {recursive: true});
    writeConfigFile(userDataDir, emptyConfig);

    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);

    const welcomeScreen = app.windows().find((w) => w.url().includes('welcomeScreen')) ??
        await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('welcomeScreen'),
            timeout: 15_000,
        });
    await welcomeScreen.waitForLoadState('domcontentloaded');
    return {app, welcomeScreen, userDataDir};
}
