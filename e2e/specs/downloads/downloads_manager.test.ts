// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoMattermostConfig} from '../../helpers/config';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

test.describe('downloads/downloads_manager', () => {
    test('MM-22239 should open downloads dropdown when a download starts', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
        if (!process.env.MM_TEST_SERVER_URL) {
            test.skip(true, 'MM_TEST_SERVER_URL required');
            return;
        }

        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const config = {
            ...demoMattermostConfig,
            servers: [
                ...demoMattermostConfig.servers,
                {
                    url: 'https://community.mattermost.com',
                    name: 'community',
                    order: 0,
                },
            ],
        };

        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config));

        const {_electron: electron} = await import('playwright');
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        const filename = `${Date.now().toString()}.txt`;
        const downloadsLocation = path.join(userDataDir, 'Downloads');

        try {
            await waitForAppReady(app);
            const serverMap = await buildServerMap(app);
            const firstServer = serverMap[config.servers[0].name]?.[0]?.win;
            if (!firstServer) {
                test.skip(true, 'No server view available');
                return;
            }

            await loginToMattermost(firstServer);

            await firstServer.waitForSelector('#post_textbox');
            const fileInput = await firstServer.waitForSelector('input#fileUploadInput');
            await fileInput.setInputFiles({
                name: filename,
                mimeType: 'text/plain',
                buffer: Buffer.from('this is test file'),
            });
            await firstServer.click('[aria-label="Send Now"]');

            await firstServer.locator(`a[download="${filename}"]`).click();

            const downloadsWindow = await app.waitForEvent('window', {
                predicate: (w) => w.url().includes('downloadsDropdown'),
                timeout: 15_000,
            });
            const isVisible = await downloadsWindow.isVisible('.DownloadsDropdown');
            expect(isVisible).toBe(true);
        } finally {
            await app.close();
            fs.rmSync(downloadsLocation, {recursive: true, force: true});
        }
    });
});
