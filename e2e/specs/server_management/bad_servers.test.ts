// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {electronBinaryPath, appDir, demoConfig, demoMattermostConfig} from '../../helpers/config';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {loginToMattermost} from '../../helpers/login';
import {buildServerMap} from '../../helpers/serverMap';

const UNREACHABLE_SERVER_URL = 'https://jhsgefhjsaeiuofhseifuphoauifdhjauiowijdfcpohuawoiudfjpdhauwodjahwdpojaoiwdhawhdiuawd.com';
const EXPIRED_CERT_URL = 'https://expired.badssl.com';
const TLS_1_0_URL = 'https://tls-v1-0.badssl.com:1010';
const TLS_1_1_URL = 'https://tls-v1-1.badssl.com';
const RC4_CIPHER_URL = 'https://rc4.badssl.com';

async function launchWithConfig(testInfo: {outputDir: string}, config: object) {
    const {mkdirSync} = await import('fs');
    const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
    mkdirSync(userDataDir, {recursive: true});
    fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config));
    const {_electron: electron} = await import('playwright');
    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });
    await waitForAppReady(app);
    return {app, userDataDir};
}

async function openAddServerModal(app: Awaited<ReturnType<typeof launchWithConfig>>['app']) {
    const mainView = app.windows().find((w) => w.url().includes('index'));
    await mainView!.click('.ServerDropdownButton');
    let dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
    if (!dropdownView) {
        dropdownView = await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('dropdown'),
            timeout: 10_000,
        });
    }
    await dropdownView.waitForLoadState().catch(() => {});
    await dropdownView!.click('.ServerDropdown .ServerDropdown__button.addServer');
    const newServerView = await app.waitForEvent('window', {
        predicate: (w) => w.url().includes('newServer'),
    });
    return newServerView;
}

/**
 * Wait for the renderer's MainPage to fully mount (so its onLoadFailed listener is
 * registered), then reload the current server view so any load failure that fired
 * before the listener was ready is re-triggered and properly propagated to the UI.
 *
 * Pre-configured bad-server tests fail without this because Chromium can reject an
 * SSL certificate before the renderer finishes mounting and registering IPC listeners,
 * causing the ErrorView never to appear.
 */
async function waitForRendererThenReload(app: Awaited<ReturnType<typeof launchWithConfig>>['app']) {
    const mainWindow = app.windows().find((w) => w.url().includes('index'));
    if (!mainWindow) {
        return;
    }

    // ServerDropdownButton renders once componentDidMount has finished and IPC listeners
    // are registered, so waiting for it is a reliable proxy for "renderer is ready".
    await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 15_000}).catch(() => {});

    // Reload the current server view so the load-failure fires after the listener is set.
    await app.evaluate(({webContents}) => {
        const refs = (global as any).__e2eTestRefs;
        const currentServerId = refs?.ServerManager?.getCurrentServerId?.();
        if (!currentServerId) {
            return;
        }
        const views: Array<{id: string}> = refs.ViewManager?.getViewsByServerId?.(currentServerId) ?? [];
        if (views.length === 0) {
            return;
        }
        const wcEntry = refs.WebContentsManager?.getView?.(views[0].id);
        if (wcEntry?.webContentsId) {
            webContents.fromId(wcEntry.webContentsId)?.reload?.();
        }
    });
}

async function openServerDropdown(app: Awaited<ReturnType<typeof launchWithConfig>>['app']) {
    const mainView = app.windows().find((w) => w.url().includes('index'));
    expect(mainView).toBeDefined();

    await mainView!.click('.ServerDropdownButton');

    let dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
    if (!dropdownView) {
        dropdownView = await app.waitForEvent('window', {
            predicate: (w) => w.url().includes('dropdown'),
            timeout: 10_000,
        });
    }

    await dropdownView.waitForLoadState().catch(() => {});
    return dropdownView;
}

test.describe('Bad Server Configurations', () => {
    test.describe.configure({mode: 'serial'});

    test.describe('Adding servers via Add Server Modal', () => {
        test('should handle server with unresolvable DNS', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, userDataDir} = await launchWithConfig(testInfo, demoConfig);
            try {
                const newServerView = await openAddServerModal(app);
                await newServerView.type('#serverNameInput', 'Unreachable Server');
                await newServerView.type('#serverUrlInput', UNREACHABLE_SERVER_URL);
                await newServerView.click('#newServerModal_confirm');

                const configPath = path.join(userDataDir, 'config.json');
                await expect.poll(() => {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    return cfg.servers.find((s: {name: string}) => s.name === 'Unreachable Server');
                }, {timeout: 10000}).toBeDefined();

                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_NAME_NOT_RESOLVED');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('should handle server with expired certificate', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, userDataDir} = await launchWithConfig(testInfo, demoConfig);
            try {
                const newServerView = await openAddServerModal(app);
                await newServerView.type('#serverNameInput', 'Expired Cert Server');
                await newServerView.type('#serverUrlInput', EXPIRED_CERT_URL);
                await newServerView.click('#newServerModal_confirm');

                const configPath = path.join(userDataDir, 'config.json');
                await expect.poll(() => {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    return cfg.servers.find((s: {name: string}) => s.name === 'Expired Cert Server');
                }, {timeout: 10000}).toBeDefined();

                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_CERT_DATE_INVALID');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('should handle server using TLS 1.0', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, userDataDir} = await launchWithConfig(testInfo, demoConfig);
            try {
                const newServerView = await openAddServerModal(app);
                await newServerView.type('#serverNameInput', 'TLS 1.0 Server');
                await newServerView.type('#serverUrlInput', TLS_1_0_URL);
                await newServerView.click('#newServerModal_confirm');

                const configPath = path.join(userDataDir, 'config.json');
                await expect.poll(() => {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    return cfg.servers.find((s: {name: string}) => s.name === 'TLS 1.0 Server');
                }, {timeout: 10000}).toBeDefined();

                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toMatch(/ERR_SSL_(VERSION_OR_CIPHER_MISMATCH|PROTOCOL_ERROR)/);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('should handle server using RC4 cipher', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {app, userDataDir} = await launchWithConfig(testInfo, demoConfig);
            try {
                const newServerView = await openAddServerModal(app);
                await newServerView.type('#serverNameInput', 'RC4 Cipher Server');
                await newServerView.type('#serverUrlInput', RC4_CIPHER_URL);
                await newServerView.click('#newServerModal_confirm');

                const configPath = path.join(userDataDir, 'config.json');
                await expect.poll(() => {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    return cfg.servers.find((s: {name: string}) => s.name === 'RC4 Cipher Server');
                }, {timeout: 10000}).toBeDefined();

                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toMatch(/ERR_SSL_(OBSOLETE_CIPHER|VERSION_OR_CIPHER_MISMATCH)/);
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });
    });

    test.describe('Pre-configured servers', () => {
        test('should handle pre-configured unreachable server', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const badConfig = {
                ...demoConfig,
                servers: [
                    {
                        name: 'Pre-configured Unreachable',
                        url: `${UNREACHABLE_SERVER_URL}/`,
                        order: 0,
                    },
                    ...demoConfig.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            const {app, userDataDir} = await launchWithConfig(testInfo, badConfig);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_NAME_NOT_RESOLVED');
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('should handle pre-configured unreachable server and still allow login to working Mattermost server', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            if (!process.env.MM_TEST_SERVER_URL) {
                test.skip(true, 'MM_TEST_SERVER_URL required');
                return;
            }
            const badConfig = {
                ...demoMattermostConfig,
                servers: [
                    {
                        name: 'Pre-configured Unreachable',
                        url: `${UNREACHABLE_SERVER_URL}/`,
                        order: 0,
                    },
                    ...demoMattermostConfig.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            const {app, userDataDir} = await launchWithConfig(testInfo, badConfig);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();

                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_NAME_NOT_RESOLVED');

                const dropdownView = await openServerDropdown(app);
                await dropdownView!.click('.ServerDropdown .ServerDropdown__button:nth-child(2)');

                const serverMap = await buildServerMap(app);
                const mmServer = serverMap[demoMattermostConfig.servers[0].name][0].win;
                await loginToMattermost(mmServer);

                await mmServer.waitForSelector('#post_textbox');
                const postTextbox = await mmServer.$('#post_textbox');
                expect(postTextbox).toBeDefined();
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('should handle pre-configured server with expired certificate', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const badConfig = {
                ...demoConfig,
                servers: [
                    {
                        name: 'Pre-configured Expired Cert',
                        url: EXPIRED_CERT_URL,
                        order: 0,
                    },
                    ...demoConfig.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            const {app, userDataDir: badCertUserDataDir} = await launchWithConfig(testInfo, badConfig);
            try {
                // Ensure the renderer has mounted its IPC listeners before the load failure
                // fires, then reload to re-trigger the failure so it reaches the UI.
                await waitForRendererThenReload(app);

                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_CERT_DATE_INVALID');
            } finally {
                await app.close();
                await waitForLockFileRelease(badCertUserDataDir);
            }
        });

        test('should load pre-configured server with expired certificate when certificate is trusted in CertificateStore', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
            mkdirSync(userDataDir, {recursive: true});

            const certificateStorePath = path.join(userDataDir, 'certificate.json');
            const certificateStore = {
                [EXPIRED_CERT_URL]: {
                    data: '-----BEGIN CERTIFICATE-----\nMIIFSzCCBDOgAwIBAgIQSueVSfqavj8QDxekeOFpCTANBgkqhkiG9w0BAQsFADCB\nkDELMAkGA1UEBhMCR0IxGzAZBgNVBAgTEkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4G\nA1UEBxMHU2FsZm9yZDEaMBgGA1UEChMRQ09NT0RPIENBIExpbWl0ZWQxNjA0BgNV\nBAMTLUNPTU9ETyBSU0EgRG9tYWluIFZhbGlkYXRpb24gU2VjdXJlIFNlcnZlciBD\nQTAeFw0xNTA0MDkwMDAwMDBaFw0xNTA0MTIyMzU5NTlaMFkxITAfBgNVBAsTGERv\nbWFpbiBDb250cm9sIFZhbGlkYXRlZDEdMBsGA1UECxMUUG9zaXRpdmVTU0wgV2ls\nZGNhcmQxFTATBgNVBAMUDCouYmFkc3NsLmNvbTCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBAMIE7PiM7gTCs9hQ1XBYzJMY61yoaEmwIrX5lZ6xKyx2PmzA\nS2BMTOqytMAPgLaw+XLJhgL5XEFdEyt/ccRLvOmULlA3pmccYYz2QULFRtMWhyef\ndOsKnRFSJiFzbIRMeVXk0WvoBj1IFVKtsyjbqv9u/2CVSndrOfEk0TG23U3AxPxT\nuW1CrbV8/q71FdIzSOciccfCFHpsKOo3St/qbLVytH5aohbcabFXRNsKEqveww9H\ndFxBIuGa+RuT5q0iBikusbpJHAwnnqP7i/dAcgCskgjZjFeEU4EFy+b+a1SYQCeF\nxxC7c3DvaRhBB0VVfPlkPz0sw6l865MaTIbRyoUCAwEAAaOCAdUwggHRMB8GA1Ud\nIwQYMBaAFJCvajqUWgvYkOoSVnPfQ7Q6KNrnMB0GA1UdDgQWBBSd7sF7gQs6R2lx\nGH0RN5O8pRs/+zAOBgNVHQ8BAf8EBAMCBaAwDAYDVR0TAQH/BAIwADAdBgNVHSUE\nFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwTwYDVR0gBEgwRjA6BgsrBgEEAbIxAQIC\nBzArMCkGCCsGAQUFBwIBFh1odHRwczovL3NlY3VyZS5jb21vZG8uY29tL0NQUzAI\nBgZngQwBAgEwVAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5jb21vZG9jYS5j\nb20vQ09NT0RPUlNBRG9tYWluVmFsaWRhdGlvblNlY3VyZVNlcnZlckNBLmNybDCB\nhQYIKwYBBQUHAQEEeTB3ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LmNvbW9kb2Nh\nLmNvbS9DT01PRE9SU0FEb21haW5WYWxpZGF0aW9uU2VjdXJlU2VydmVyQ0EuY3J0\nMCQGCCsGAQUFBzABhhhodHRwOi8vb2NzcC5jb21vZG9jYS5jb20wIwYDVR0RBBww\nGoIMKi5iYWRzc2wuY29tggpiYWRzc2wuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQBq\nevHa/wMHcnjFZqFPRkMOXxQhjHUa6zbgH6QQFezaMyV8O7UKxwE4PSf9WNnM6i1p\nOXy+l+8L1gtY54x/v7NMHfO3kICmNnwUW+wHLQI+G1tjWxWrAPofOxkt3+IjEBEH\nfnJ/4r+3ABuYLyw/zoWaJ4wQIghBK4o+gk783SHGVnRwpDTysUCeK1iiWQ8dSO/r\nET7BSp68ZVVtxqPv1dSWzfGuJ/ekVxQ8lEEFeouhN0fX9X3c+s5vMaKwjOrMEpsi\n8TRwz311SotoKQwe6Zaoz7ASH1wq7mcvf71z81oBIgxw+s1F73hczg36TuHvzmWf\nRwxPuzZEaFZcVlmtqoq8\n-----END CERTIFICATE-----\n',
                    issuerName: 'COMODO RSA Domain Validation Secure Server CA',
                    dontTrust: false,
                },
            };
            fs.writeFileSync(certificateStorePath, JSON.stringify(certificateStore, null, 2));

            const badConfig = {
                ...demoConfig,
                servers: [
                    {
                        name: 'Pre-configured Expired Cert Trusted',
                        url: EXPIRED_CERT_URL,
                        order: 0,
                    },
                    ...demoConfig.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
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
                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();

                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeNull();
            } finally {
                await app.close();
                await waitForLockFileRelease(userDataDir);
            }
        });

        test('should handle pre-configured server using TLS 1.1', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const badConfig = {
                ...demoConfig,
                servers: [
                    {
                        name: 'Pre-configured TLS 1.1',
                        url: TLS_1_1_URL,
                        order: 0,
                    },
                    ...demoConfig.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            const {app, userDataDir: tls11UserDataDir} = await launchWithConfig(testInfo, badConfig);
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toMatch(/ERR_SSL_(VERSION_OR_CIPHER_MISMATCH|PROTOCOL_ERROR)/);
            } finally {
                await app.close();
                await waitForLockFileRelease(tls11UserDataDir);
            }
        });

        test('should handle pre-configured server using RC4 cipher', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            const badConfig = {
                ...demoConfig,
                servers: [
                    {
                        name: 'Pre-configured RC4',
                        url: RC4_CIPHER_URL,
                        order: 0,
                    },
                    ...demoConfig.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            const {app, userDataDir: rc4UserDataDir} = await launchWithConfig(testInfo, badConfig);
            try {
                // Ensure the renderer has mounted its IPC listeners before the load failure
                // fires, then reload to re-trigger the failure so it reaches the UI.
                await waitForRendererThenReload(app);

                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await mainWindow!.waitForSelector('.ErrorView', {timeout: 30000});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toMatch(/ERR_SSL_(OBSOLETE_CIPHER|VERSION_OR_CIPHER_MISMATCH)/);
            } finally {
                await app.close();
                await waitForLockFileRelease(rc4UserDataDir);
            }
        });
    });
});
