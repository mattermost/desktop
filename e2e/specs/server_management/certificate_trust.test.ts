// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {demoConfig} from '../../helpers/config';
import {answerMessageModal, clearCertificateErrorCallbacks} from '../../helpers/dialog';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {closeElectronApp, closeElectronAppFast} from '../../helpers/electronApp';
import {waitForErrorView} from '../../helpers/errorView';
import {buildServerMap} from '../../helpers/serverMap';
import {evaluateInMainProcess, isTransientEvaluateError, isTransientNavigationError} from '../../helpers/testRefs';

const EXPIRED_CERT_URL = 'https://expired.badssl.com';

test(
    'MM-T2631 SEC-03 trusting an invalid certificate allows the server view to load',
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

        let firstAppClosed = false;
        const app = await launchDirectTestApp(userDataDir, badConfig, {
            writeConfig: false,
        });

        try {
            await answerMessageModal(app, 1, 45_000); // Cancel Connection on the launch cert prompt
            await waitForErrorView(app);

            await clearCertificateErrorCallbacks(app);

            await evaluateInMainProcess(app, () => {
                const refs = (global as any).__e2eTestRefs;
                if (!refs) {
                    throw new Error('__e2eTestRefs missing (NODE_ENV must be test)');
                }
                const server = refs.ServerManager.getOrderedServers()?.[0];
                if (!server) {
                    throw new Error('No server available to reload');
                }
                refs.ServerManager.reloadServer(server.id);
            }, {timeoutMs: 30_000});

            await answerMessageModal(app, 0, 45_000); // More Details
            await answerMessageModal(app, 0, 45_000); // Trust Insecure Certificate

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

            await closeElectronApp(app, userDataDir);
            firstAppClosed = true;

            // Relaunch on whatever the app itself persisted: the server entry must
            // survive the reloadServer above, and certificate.json must carry the
            // trust decision across restarts.
            const relaunchedApp = await launchDirectTestApp(userDataDir, badConfig, {
                writeConfig: false,
            });
            try {
                // System-clock changes (MM-T2631 step 1) are not automatable; expired.badssl.com
                // is the stand-in. The relaunch proves trust persisted — a new untrusted cert
                // would prompt again and ErrorView would reappear.
                await expect.poll(async () => {
                    try {
                        const serverMap = await buildServerMap(relaunchedApp);
                        const entry = serverMap['Expired Cert']?.[0];
                        if (!entry) {
                            return '';
                        }
                        return await entry.win.url();
                    } catch (error) {
                        if (isTransientEvaluateError(error) || isTransientNavigationError(error)) {
                            return '';
                        }
                        throw error;
                    }
                }, {
                    timeout: 45_000,
                    message: 'Relaunch after trust must load expired.badssl.com without a new cert prompt',
                }).toMatch(/^https:\/\/expired\.badssl\.com(?:\/|$)/);

                const mainWindow = relaunchedApp.windows().find((window) => window.url().includes('index'));
                expect(mainWindow, 'Main window must exist after relaunch').toBeDefined();
                expect(await mainWindow!.$('.ErrorView')).toBeNull();
                expect(fs.existsSync(certificateStorePath), 'Trusted certificate store must survive relaunch').toBe(true);
            } finally {
                await closeElectronAppFast(relaunchedApp, userDataDir);
            }
        } finally {
            if (!firstAppClosed) {
                await closeElectronAppFast(app, userDataDir);
            }
        }
    },
);
