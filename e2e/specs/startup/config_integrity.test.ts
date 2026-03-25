// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForLockFileRelease} from '../../helpers/cleanup';

test(
    'config.json is valid JSON after app closes normally',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const {mkdirSync} = await import('fs');
        const userDataDir = testInfo.outputDir + '/integrity-userdata';
        mkdirSync(userDataDir, {recursive: true});

        const {_electron: electron} = await import('playwright');
        const {electronBinaryPath, appDir, demoConfig, writeConfigFile} = await import('../../helpers/config');
        const {waitForAppReady} = await import('../../helpers/appReadiness');

        writeConfigFile(userDataDir, demoConfig);

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        try {
            await waitForAppReady(app);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }

        // Config file must exist and be valid JSON
        const configPath = path.join(userDataDir, 'config.json');
        expect(fs.existsSync(configPath)).toBe(true);

        const raw = fs.readFileSync(configPath, 'utf8');
        expect(() => JSON.parse(raw)).not.toThrow();

        const config = JSON.parse(raw);
        expect(config.version).toBeGreaterThan(0);
        expect(Array.isArray(config.servers)).toBe(true);
    },
);

test(
    'malformed config.json at startup does not crash the app',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const {mkdirSync} = await import('fs');
        const userDataDir = testInfo.outputDir + '/corrupt-userdata';
        mkdirSync(userDataDir, {recursive: true});

        // Write intentionally malformed JSON
        fs.writeFileSync(path.join(userDataDir, 'config.json'), '{invalid json}}}');

        const {_electron: electron} = await import('playwright');
        const {electronBinaryPath, appDir} = await import('../../helpers/config');
        const {waitForAppReady} = await import('../../helpers/appReadiness');

        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        try {
            // App should not crash — it should start with defaults or welcome screen
            await waitForAppReady(app);
            const windows = app.windows();
            expect(windows.length).toBeGreaterThan(0);
        } finally {
            await app.close();
            await waitForLockFileRelease(userDataDir);
        }
    },
);
