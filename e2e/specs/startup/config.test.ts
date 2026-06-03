// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {exampleURL} from '../../helpers/config';

test.describe('startup/config', () => {
    test(
        'MM-T4401_1 should show correct server in the dropdown button',
        {tag: ['@P1', '@all']},
        async ({mainWindow}) => {
            const text = await mainWindow.innerText('.ServerDropdownButton');
            expect(text).toBe('example');
        },
    );

    test(
        'MM-T4401_2 should set src of browser view from config file',
        {tag: ['@P1', '@all']},
        async ({serverMap}) => {
            const firstServer = serverMap.example?.[0]?.win;
            const secondServer = serverMap.github?.[0]?.win;
            expect(firstServer).toBeDefined();
            expect(secondServer).toBeDefined();
            await expect.poll(() => firstServer!.url(), {timeout: 10_000}).toContain('example.com');
            await expect.poll(() => secondServer!.url(), {timeout: 10_000}).toContain('github.com');
        },
    );

    test(
        'MM-T4402 should upgrade v0 config file',
        {tag: ['@P1', '@all']},
        async ({}, testInfo) => {
            // Write a v0 config file, launch a fresh app, verify it upgrades
            // True v0 format: just a url string, no version field.
            // The Config module detects v0 by absence of a version field.
            const v0Config = {
                url: exampleURL,
            };
            const v0Dir = path.join(testInfo.outputDir, 'v0-userdata');
            fs.mkdirSync(v0Dir, {recursive: true});
            fs.writeFileSync(path.join(v0Dir, 'config.json'), JSON.stringify(v0Config));

            const {_electron: electron} = await import('playwright');
            const {electronBinaryPath, appDir} = await import('../../helpers/config');

            const upgradedApp = await electron.launch({
                executablePath: electronBinaryPath,
                args: [appDir, `--user-data-dir=${v0Dir}`, '--no-sandbox', '--disable-gpu'],
                env: {...process.env, NODE_ENV: 'test'},
                timeout: 60_000,
            });

            try {
                // Give app time to read and upgrade the config
                const {waitForAppReady} = await import('../../helpers/appReadiness');
                await waitForAppReady(upgradedApp);

                const configRaw = fs.readFileSync(path.join(v0Dir, 'config.json'), 'utf8');
                const upgraded = JSON.parse(configRaw);
                expect(upgraded.version).toBeGreaterThan(0);
                expect(upgraded.servers).toBeDefined();
                expect(upgraded.servers[0].url).toContain('example.com');
            } finally {
                await upgradedApp.close();
                await waitForLockFileRelease(v0Dir);
            }
        },
    );
});
