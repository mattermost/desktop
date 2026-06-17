// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ElectronApplication} from 'playwright';
import {_electron as electron} from 'playwright';

import {waitForAppReady} from './appReadiness';
import {electronBinaryPath, appDir, writeConfigFile, type AppConfig} from './config';
import {registerElectronMainProcess} from './electronApp';

export const DIRECT_LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-dev-shm-usage',
    '--no-zygote',
    '--disable-software-rasterizer',
    '--disable-breakpad',
    '--disable-features=SpareRendererForSitePerProcess',
    '--disable-features=CrossOriginOpenerPolicy',
    '--disable-renderer-backgrounding',
    '--no-first-run',
    '--disable-default-apps',
    '--disable-crash-reporter',
    '--force-color-profile=srgb',
    '--mute-audio',
];

export async function launchDirectTestApp(
    userDataDir: string,
    config: AppConfig | object,
    extraEnv: Record<string, string> = {},
): Promise<ElectronApplication> {
    writeConfigFile(userDataDir, config as AppConfig);

    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, ...DIRECT_LAUNCH_ARGS],
        env: {
            ...process.env,
            NODE_ENV: 'test',
            RESOURCES_PATH: appDir,
            ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
            ELECTRON_NO_ATTACH_CONSOLE: 'true',
            NODE_OPTIONS: '--no-warnings',
            ...extraEnv,
        },
        timeout: process.platform === 'win32' ? 120_000 : 90_000,
    });

    registerElectronMainProcess(app.process()?.pid);
    await waitForAppReady(app);
    return app;
}
