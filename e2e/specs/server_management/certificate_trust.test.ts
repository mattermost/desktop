// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig} from '../../helpers/config';
import {clearCertificateErrorCallbacks, restoreMessageBox, setAutoTrustCertificate} from '../../helpers/dialog';
import {closeElectronAppFast} from '../../helpers/electronApp';
import {waitForErrorView} from '../../helpers/errorView';

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
            ],
            lastActiveServer: 0,
        };

        fs.mkdirSync(userDataDir, {recursive: true});
        fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(badConfig));

        const {_electron: electron} = await import('playwright');
        const app = await electron.launch({
            executablePath: electronBinaryPath,
            args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                MM_E2E_STUB_MESSAGE_BOX: 'cancel',
            },
            timeout: 60_000,
        });

        try {
            await waitForAppReady(app);
            await waitForErrorView(app);

            await clearCertificateErrorCallbacks(app);
            await setAutoTrustCertificate(app, true);

            await app.evaluate(() => {
                const refs = (global as any).__e2eTestRefs;
                const server = refs?.ServerManager?.getOrderedServers?.()?.[0];
                if (!server) {
                    throw new Error('No server available to reload');
                }
                refs.ServerManager.reloadServer(server.id);
            });

            const certificateStorePath = path.join(userDataDir, 'certificate.json');

            await expect.poll(async () => {
                const mainWindow = app.windows().find((window) => window.url().includes('index'));
                const errorView = await mainWindow?.$('.ErrorView');
                return errorView === null && fs.existsSync(certificateStorePath);
            }, {
                timeout: 45_000,
                message: 'Trusted certificate should persist to certificate.json and clear ErrorView',
            }).toBe(true);

            const certificateStore = JSON.parse(fs.readFileSync(certificateStorePath, 'utf-8')) as Record<string, unknown>;
            expect(Object.keys(certificateStore).length).toBeGreaterThan(0);
        } finally {
            await setAutoTrustCertificate(app, false).catch(() => {});
            await restoreMessageBox(app).catch(() => {});
            await closeElectronAppFast(app, userDataDir);
        }
    },
);
