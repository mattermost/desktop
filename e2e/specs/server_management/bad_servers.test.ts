// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {test, expect} from '../../fixtures/index';
import {demoConfig, demoMattermostConfig} from '../../helpers/config';
import {launchDirectTestApp} from '../../helpers/directLaunch';
import {closeElectronAppFast} from '../../helpers/electronApp';
import {waitForErrorView} from '../../helpers/errorView';
import {loginToMattermost} from '../../helpers/login';
import {closeOverlayWindowsIfOpen} from '../../helpers/overlayWindows';
import {prepareMattermostServerView} from '../../helpers/prepareServerView';
import {buildServerMap} from '../../helpers/serverMap';

const UNREACHABLE_SERVER_URL = 'https://jhsgefhjsaeiuofhseifuphoauifdhjauiowijdfcpohuawoiudfjpdhauwodjahwdpojaoiwdhawhdiuawd.com';
const EXPIRED_CERT_URL = 'https://expired.badssl.com';
const TLS_1_0_URL = 'https://tls-v1-0.badssl.com:1010';
const TLS_1_1_URL = 'https://tls-v1-1.badssl.com';
const RC4_CIPHER_URL = 'https://rc4.badssl.com';
const INSECURE_TLS_ERROR_PATTERN = /ERR_SSL_(VERSION_OR_CIPHER_MISMATCH|PROTOCOL_ERROR|OBSOLETE_CIPHER)|ERR_CONNECTION_RESET|ERR_ABORTED/;

async function launchWithConfig(testInfo: {outputDir: string}, config: object) {
    const {mkdirSync} = await import('fs');
    const userDataDir = path.join(testInfo.outputDir, 'custom-userdata');
    mkdirSync(userDataDir, {recursive: true});
    const app = await launchDirectTestApp(userDataDir, config, {MM_E2E_STUB_MESSAGE_BOX: 'cancel'});
    return {app, userDataDir};
}

/**
 * Read a server by name from config.json, tolerating a transient parse failure.
 * Config.saveLocalConfigData() persists via JsonFileManager.write(), which calls
 * Node's fs.writeFile() — that truncates the file before writing the new content,
 * it isn't an atomic write-to-temp-then-rename. Since this reads the same file
 * from a separate process (the Playwright test runner) while the app may still
 * be mid-write, an empty/partial read is a real possibility, not a hypothetical
 * one — confirmed in CI as `SyntaxError: Unexpected end of JSON input` on a
 * RC4-cipher run. Returning undefined here lets the caller's expect.poll keep
 * retrying instead of letting the exception fail the test outright.
 */
function findServerInConfig(configPath: string, serverName: string): {name: string} | undefined {
    let raw: string;
    try {
        raw = fs.readFileSync(configPath, 'utf8');
    } catch {
        return undefined;
    }
    if (!raw) {
        return undefined;
    }
    let cfg: {servers?: Array<{name: string}>};
    try {
        cfg = JSON.parse(raw);
    } catch {
        return undefined;
    }
    return cfg.servers?.find((s) => s.name === serverName);
}

/**
 * Click the server dropdown button and wait for its WebContentsView to
 * appear, re-clicking periodically until it does.
 *
 * Root cause (found via a diagnostic build that dumped DOM/window state on
 * failure): ServerDropdownView.handleOpen() in src/app/mainWindow/
 * serverDropdownView.ts silently no-ops if its WebContentsView hasn't been
 * created yet — that view is created lazily by init(), run on the
 * MAIN_WINDOW_CREATED event, which can still be pending on a freshly-booted
 * shared app under CI load. The diagnostic confirmed the button itself is
 * fully visible/enabled/unobstructed at click time, and the dropdown.html
 * window never appears at all — not a DOM/focus issue, the click is just
 * arriving before the feature is wired up.
 *
 * Re-clicking here is safe (unlike re-clicking an already-open dropdown):
 * handleOpen() only flips isOpen / notifies the renderer once its view
 * exists, so a click that lands before then changes no state on either the
 * main or renderer side — the next click is treated as a fresh "open"
 * attempt, not a toggle-to-close.
 */
async function openServerDropdownWindow(app: Awaited<ReturnType<typeof launchWithConfig>>['app']) {
    const mainView = app.windows().find((w) => w.url().includes('index'));
    await mainView!.bringToFront().catch(() => {});

    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline) {
        await mainView!.click('.ServerDropdownButton');
        const appeared = await expect.poll(
            () => app.windows().some((w) => w.url().includes('dropdown')),
            {timeout: 3_000},
        ).toBe(true).then(() => true).catch(() => false);
        if (appeared) {
            break;
        }
    }

    const dropdownView = app.windows().find((w) => w.url().includes('dropdown'));
    if (!dropdownView) {
        throw new Error('Server dropdown window did not appear after repeated clicks over 40s');
    }
    await dropdownView.waitForLoadState().catch(() => {});
    return dropdownView;
}

async function openAddServerModal(app: Awaited<ReturnType<typeof launchWithConfig>>['app']) {
    const dropdownView = await openServerDropdownWindow(app);

    await dropdownView.click('.ServerDropdown .ServerDropdown__button.addServer');

    // The new-server modal is a WebContentsView, not a BrowserWindow, so it can
    // appear a beat after the click. Polling `app.windows()` picks it up on the
    // next tick regardless of exactly when it was created — no event-listener
    // pre-registration needed, since polling isn't edge-triggered.
    await expect.poll(
        () => app.windows().some((w) => w.url().includes('newServer')),
        {timeout: 20_000, message: 'New server modal window should appear after clicking Add a server'},
    ).toBe(true);

    const newServerView = app.windows().find((w) => w.url().includes('newServer'));
    if (!newServerView) {
        throw new Error('New server modal window did not appear');
    }
    await newServerView.waitForLoadState().catch(() => {});
    return newServerView;
}

async function openServerDropdown(app: Awaited<ReturnType<typeof launchWithConfig>>['app']) {
    return openServerDropdownWindow(app);
}

test.describe('Bad Server Configurations', () => {
    test.describe.configure({mode: 'serial'});

    test.describe('Adding servers via Add Server Modal', () => {
        let sharedApp: Awaited<ReturnType<typeof launchWithConfig>>['app'];
        let sharedUserDataDir: string;

        test.beforeAll(async ({}, testInfo) => {
            const {mkdirSync} = await import('fs');
            sharedUserDataDir = path.join(testInfo.outputDir, 'add-server-shared');
            mkdirSync(sharedUserDataDir, {recursive: true});
            sharedApp = await launchDirectTestApp(sharedUserDataDir, demoConfig, {MM_E2E_STUB_MESSAGE_BOX: 'cancel'});
        });

        test.afterAll(async () => {
            await closeElectronAppFast(sharedApp, sharedUserDataDir);
        });

        // Deliberately NO defensive beforeEach here to close stray dropdown/newServer
        // windows: a `.includes('dropdown')` URL filter matches the SERVER DROPDOWN's
        // own WebContentsView (mattermost-desktop://renderer/dropdown.html), which is
        // created at MAIN_WINDOW_CREATED and required for OPEN_SERVERS_DROPDOWN to work
        // (ServerDropdownView.handleOpen returns silently if this.view is destroyed).
        // Closing it via Playwright's Page.close() destroys the WebContents, so every
        // subsequent click on .ServerDropdownButton silently no-ops. Diagnosed from CI
        // trace showing 13 clicks over 40s producing no dropdown. If serial-mode tests
        // ever leak state, prefer sending CLOSE_SERVERS_DROPDOWN via IPC instead of
        // Page.close(), or press Escape at test end.

        test('should handle server with unresolvable DNS', {tag: ['@P2', '@all']}, async () => {
            const app = sharedApp;
            const userDataDir = sharedUserDataDir;
            const newServerView = await openAddServerModal(app);
            await newServerView.type('#serverNameInput', 'Unreachable Server');
            await newServerView.type('#serverUrlInput', UNREACHABLE_SERVER_URL);
            await newServerView.click('#newServerModal_confirm');

            const configPath = path.join(userDataDir, 'config.json');
            await expect.poll(
                () => findServerInConfig(configPath, 'Unreachable Server'),
                {timeout: 10000},
            ).toBeDefined();

            const mainWindow = app.windows().find((w) => w.url().includes('index'));
            expect(mainWindow).toBeDefined();
            await waitForErrorView(app, {serverName: 'Unreachable Server', waitForActiveServer: true});
            const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
            expect(errorInfo).toContain('ERR_NAME_NOT_RESOLVED');
        });

        test('should handle server with expired certificate', {tag: ['@P2', '@all']}, async () => {
            const app = sharedApp;
            const userDataDir = sharedUserDataDir;
            const newServerView = await openAddServerModal(app);
            await newServerView.type('#serverNameInput', 'Expired Cert Server');
            await newServerView.type('#serverUrlInput', EXPIRED_CERT_URL);
            await newServerView.click('#newServerModal_confirm');

            const configPath = path.join(userDataDir, 'config.json');
            await expect.poll(
                () => findServerInConfig(configPath, 'Expired Cert Server'),
                {timeout: 10000},
            ).toBeDefined();

            const mainWindow = app.windows().find((w) => w.url().includes('index'));
            expect(mainWindow).toBeDefined();
            await waitForErrorView(app, {serverName: 'Expired Cert Server', waitForActiveServer: true});
            const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
            expect(errorInfo).toContain('ERR_CERT_DATE_INVALID');
        });

        test('should handle server using TLS 1.0', {tag: ['@P2', '@all']}, async () => {
            const app = sharedApp;
            const userDataDir = sharedUserDataDir;
            const newServerView = await openAddServerModal(app);
            await newServerView.type('#serverNameInput', 'TLS 1.0 Server');
            await newServerView.type('#serverUrlInput', TLS_1_0_URL);
            await newServerView.click('#newServerModal_confirm');

            const configPath = path.join(userDataDir, 'config.json');
            await expect.poll(
                () => findServerInConfig(configPath, 'TLS 1.0 Server'),
                {timeout: 10000},
            ).toBeDefined();

            const mainWindow = app.windows().find((w) => w.url().includes('index'));
            expect(mainWindow).toBeDefined();
            await waitForErrorView(app, {serverName: 'TLS 1.0 Server', waitForActiveServer: true});

            await expect.poll(async () => {
                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                return INSECURE_TLS_ERROR_PATTERN.test(errorInfo) ? errorInfo : null;
            }, {timeout: 15_000, message: 'TLS 1.0 server must surface a connection error'}).not.toBeNull();
        });

        test('should handle server using RC4 cipher', {tag: ['@P2', '@all']}, async () => {
            const app = sharedApp;
            const userDataDir = sharedUserDataDir;
            const newServerView = await openAddServerModal(app);
            await newServerView.type('#serverNameInput', 'RC4 Cipher Server');
            await newServerView.type('#serverUrlInput', RC4_CIPHER_URL);
            await newServerView.click('#newServerModal_confirm');

            const configPath = path.join(userDataDir, 'config.json');
            await expect.poll(
                () => findServerInConfig(configPath, 'RC4 Cipher Server'),
                {timeout: 10000},
            ).toBeDefined();

            const mainWindow = app.windows().find((w) => w.url().includes('index'));
            expect(mainWindow).toBeDefined();
            await waitForErrorView(app, {serverName: 'RC4 Cipher Server', waitForActiveServer: true});

            await expect.poll(async () => {
                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                return INSECURE_TLS_ERROR_PATTERN.test(errorInfo) ? errorInfo : null;
            }, {timeout: 15_000, message: 'RC4 server must surface a connection error'}).not.toBeNull();
        });
    });

    test.describe('Pre-configured servers', () => {
        test('MULTI-01 unreachable server at startup does not block other servers', {tag: ['@P0', '@all']}, async ({}, testInfo) => {
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
                await waitForErrorView(app, {serverName: 'Pre-configured Unreachable', waitForActiveServer: false});

                const start = Date.now();
                const dropdownView = await openServerDropdown(app);
                await dropdownView!.click('.ServerDropdown .ServerDropdown__button:nth-child(2)');

                const serverMap = await buildServerMap(app);
                const exampleServer = serverMap[demoConfig.servers[0].name]?.[0]?.win;
                expect(exampleServer).toBeDefined();

                await expect.poll(
                    () => exampleServer!.url(),
                    {timeout: 15_000, message: 'Working server should become reachable after switching away from unreachable server'},
                ).toContain('example.com');

                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeNull();
                expect(Date.now() - start).toBeLessThan(15_000);
            } finally {
                await closeElectronAppFast(app, userDataDir);
            }
        });

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
                await waitForErrorView(app, {serverName: 'Pre-configured Unreachable', waitForActiveServer: false});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_NAME_NOT_RESOLVED');
            } finally {
                await closeElectronAppFast(app, userDataDir);
            }
        });

        test('should handle pre-configured unreachable server and still allow login to working Mattermost server', {tag: ['@P2', '@all']}, async ({}, testInfo) => {
            test.setTimeout(120_000);
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

                await waitForErrorView(app, {serverName: 'Pre-configured Unreachable', waitForActiveServer: false});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_NAME_NOT_RESOLVED');

                const dropdownView = await openServerDropdown(app);
                await dropdownView!.click('.ServerDropdown .ServerDropdown__button:nth-child(2)');
                await closeOverlayWindowsIfOpen(app);

                let mmEntry: Awaited<ReturnType<typeof buildServerMap>>[string][0] | undefined;
                await expect.poll(async () => {
                    const serverMap = await buildServerMap(app);
                    mmEntry = serverMap[demoMattermostConfig.servers[0].name]?.[0];
                    return Boolean(mmEntry);
                }, {
                    timeout: 45_000,
                    message: 'Working Mattermost server view should be registered after switching servers',
                }).toBe(true);
                const mmServer = mmEntry!.win;
                const cloudHost = new URL(process.env.MM_TEST_SERVER_URL!).host;

                await expect.poll(
                    () => mmServer.url(),
                    {timeout: 45_000, message: 'Working cloud server should load after switching away from unreachable server'},
                ).toContain(cloudHost);

                await prepareMattermostServerView(app, mmEntry!.webContentsId);
                await loginToMattermost(mmServer);

                const postTextbox = await mmServer.$('#post_textbox');
                expect(postTextbox).toBeDefined();
            } finally {
                await closeElectronAppFast(app, userDataDir);
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
                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await waitForErrorView(app, {serverName: 'Pre-configured Expired Cert', waitForActiveServer: false});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                expect(errorInfo).toContain('ERR_CERT_DATE_INVALID');
            } finally {
                await closeElectronAppFast(app, badCertUserDataDir);
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

            const app = await launchDirectTestApp(userDataDir, badConfig, {
                writeConfig: false,
                extraEnv: {MM_E2E_STUB_MESSAGE_BOX: 'cancel'},
            });
            try {
                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();

                await expect.poll(async () => {
                    const serverMap = await buildServerMap(app);
                    const entry = serverMap['Pre-configured Expired Cert Trusted']?.[0];
                    if (!entry) {
                        return false;
                    }
                    const url = await entry.win.url().catch(() => '');
                    return url.includes('expired.badssl.com');
                }, {
                    timeout: 45_000,
                    message: 'Trusted expired-cert server view should finish loading before asserting ErrorView absence',
                }).toBe(true);

                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeNull();
            } finally {
                await closeElectronAppFast(app, userDataDir);
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
                await waitForErrorView(app, {serverName: 'Pre-configured TLS 1.1', waitForActiveServer: false});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                await expect.poll(async () => {
                    const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                    return INSECURE_TLS_ERROR_PATTERN.test(errorInfo) ? errorInfo : null;
                }, {timeout: 15_000, message: 'TLS 1.1 server must surface a connection error'}).not.toBeNull();
            } finally {
                await closeElectronAppFast(app, tls11UserDataDir);
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
                const mainWindow = app.windows().find((w) => w.url().includes('index'));
                expect(mainWindow).toBeDefined();
                await waitForErrorView(app, {serverName: 'Pre-configured RC4', waitForActiveServer: false});
                const errorView = await mainWindow!.$('.ErrorView');
                expect(errorView).toBeDefined();

                await expect.poll(async () => {
                    const errorInfo = await mainWindow!.innerText('.ErrorView-techInfo');
                    return INSECURE_TLS_ERROR_PATTERN.test(errorInfo) ? errorInfo : null;
                }, {timeout: 15_000, message: 'RC4 server must surface a connection error'}).not.toBeNull();
            } finally {
                await closeElectronAppFast(app, rc4UserDataDir);
            }
        });
    });
});
