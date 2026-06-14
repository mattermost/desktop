// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {restoreMessageBox, stubMessageBoxResponses} from '../../helpers/dialog';

const EXPIRED_CERT_URL = 'https://expired.badssl.com';

test(
    'SEC-03 trusting an invalid certificate allows the server view to load',
    {tag: ['@P1', '@all']},
    async ({}, testInfo) => {
        const userDataDir = path.join(testInfo.outputDir, 'userdata');
        const badConfig = {
            ...demoConfig,
            servers: [
                {
                    name: 'Expired Cert',
                    url: EXPIRED_CERT_URL,
                    order: 0,
                },
                ...demoConfig.servers.map((server, index) => ({...server, order: index + 1})),
            ],
            lastActiveServer: 0,
        };

        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(badConfig));

        const {_electron: electron} = await import('playwright');
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {...process.env, NODE_ENV: 'test'},
            timeout: 60_000,
        });

        try {
            await waitForAppReady(app);
            const mainWindow = app.windows().find((window) => window.url().includes('index'));
            expect(mainWindow).toBeDefined();
            await mainWindow!.waitForSelector('.ErrorView', {timeout: 30_000});

            await stubMessageBoxResponses(app, [
                {response: 0},
                {response: 0},
            ]);

            await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const server = refs?.ServerManager?.getOrderedServers?.()?.[0];
                if (!server) {
                    throw new Error('No server available to reload');
                }
                refs.ServerManager.reloadServer(server.id);
            });

            await expect.poll(async () => {
                const errorView = await mainWindow!.$('.ErrorView');
                return errorView === null;
            }, {
                timeout: 45_000,
                message: 'Trusted certificate should allow the expired-cert server to load without ErrorView',
            }).toBe(true);

            const certificateStorePath = path.join(userDataDir, 'certificate.json');
            await expect.poll(() => fs.existsSync(certificateStorePath)).toBe(true);
            const certificateStore = JSON.parse(fs.readFileSync(certificateStorePath, 'utf-8')) as Record<string, unknown>;
            expect(Object.keys(certificateStore).length).toBeGreaterThan(0);
        } finally {
            await restoreMessageBox(app);
            await app.close().catch(() => {});
            await waitForLockFileRelease(userDataDir);
        }
    },
);
