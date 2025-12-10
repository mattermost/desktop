// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

const UNREACHABLE_SERVER_URL = 'https://jhsgefhjsaeiuofhseifuphoauifdhjauiowijdfcpohuawoiudfjpdhauwodjahwdpojaoiwdhawhdiuawd.com';
const EXPIRED_CERT_URL = 'https://expired.badssl.com';
const TLS_1_0_URL = 'https://tls-v1-0.badssl.com:1010';
const TLS_1_1_URL = 'https://tls-v1-1.badssl.com';
const RC4_CIPHER_URL = 'https://rc4.badssl.com';

describe('Bad Server Configurations', function desc() {
    this.timeout(60000);

    const config = env.demoConfig;

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
        await env.clearElectronInstances();
    });

    describe('Adding servers via Add Server Modal', () => {
        let newServerView;

        beforeEach(async () => {
            fs.writeFileSync(env.configFilePath, JSON.stringify(config));
            await asyncSleep(1000);
            this.app = await env.getApp();

            const mainView = this.app.windows().find((window) => window.url().includes('index'));
            const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
            await mainView.click('.ServerDropdownButton');
            await dropdownView.click('.ServerDropdown .ServerDropdown__button.addServer');
            newServerView = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('newServer'),
            });
        });

        it('should handle server with unresolvable DNS', async () => {
            await newServerView.type('#serverNameInput', 'Unreachable Server');
            await newServerView.type('#serverUrlInput', UNREACHABLE_SERVER_URL);
            await newServerView.click('#newServerModal_confirm');

            await asyncSleep(1000);
            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            const addedServer = savedConfig.servers.find((s) => s.name === 'Unreachable Server');
            addedServer.should.exist;

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.include('ERR_NAME_NOT_RESOLVED');
        });

        it('should handle server with expired certificate', async () => {
            await newServerView.type('#serverNameInput', 'Expired Cert Server');
            await newServerView.type('#serverUrlInput', EXPIRED_CERT_URL);
            await newServerView.click('#newServerModal_confirm');

            await asyncSleep(1000);
            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            const addedServer = savedConfig.servers.find((s) => s.name === 'Expired Cert Server');
            addedServer.should.exist;

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.include('ERR_CERT_DATE_INVALID');
        });

        it('should handle server using TLS 1.0', async () => {
            await newServerView.type('#serverNameInput', 'TLS 1.0 Server');
            await newServerView.type('#serverUrlInput', TLS_1_0_URL);
            await newServerView.click('#newServerModal_confirm');

            await asyncSleep(1000);
            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            const addedServer = savedConfig.servers.find((s) => s.name === 'TLS 1.0 Server');
            addedServer.should.exist;

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.match(/ERR_SSL_(VERSION_OR_CIPHER_MISMATCH|PROTOCOL_ERROR)/);
        });

        it('should handle server using RC4 cipher', async () => {
            await newServerView.type('#serverNameInput', 'RC4 Cipher Server');
            await newServerView.type('#serverUrlInput', RC4_CIPHER_URL);
            await newServerView.click('#newServerModal_confirm');

            await asyncSleep(1000);
            const savedConfig = JSON.parse(fs.readFileSync(env.configFilePath, 'utf8'));
            const addedServer = savedConfig.servers.find((s) => s.name === 'RC4 Cipher Server');
            addedServer.should.exist;

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.match(/ERR_SSL_(OBSOLETE_CIPHER|VERSION_OR_CIPHER_MISMATCH)/);
        });
    });

    describe('Pre-configured servers', () => {
        it('should handle pre-configured unreachable server', async () => {
            const badConfig = {
                ...config,
                servers: [
                    {
                        name: 'Pre-configured Unreachable',
                        url: `${UNREACHABLE_SERVER_URL}/`,
                        order: 0,
                    },
                    ...config.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            fs.writeFileSync(env.configFilePath, JSON.stringify(badConfig));
            await asyncSleep(1000);
            this.app = await env.getApp();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.include('ERR_NAME_NOT_RESOLVED');
        });

        it('should handle pre-configured unreachable server and still allow login to working Mattermost server', async () => {
            const mattermostConfig = env.demoMattermostConfig;
            const badConfig = {
                ...mattermostConfig,
                servers: [
                    {
                        name: 'Pre-configured Unreachable',
                        url: `${UNREACHABLE_SERVER_URL}/`,
                        order: 0,
                    },
                    ...mattermostConfig.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            fs.writeFileSync(env.configFilePath, JSON.stringify(badConfig));
            await asyncSleep(1000);
            this.app = await env.getApp();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;

            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.include('ERR_NAME_NOT_RESOLVED');

            const dropdownView = this.app.windows().find((window) => window.url().includes('dropdown'));
            await mainWindow.click('.ServerDropdownButton');
            await dropdownView.click('.ServerDropdown .ServerDropdown__button:nth-child(2)');

            this.serverMap = await env.getServerMap(this.app);
            const mmServer = this.serverMap[mattermostConfig.servers[0].name][0].win;
            await env.loginToMattermost(mmServer);

            await mmServer.waitForSelector('#post_textbox');
            const postTextbox = await mmServer.$('#post_textbox');
            postTextbox.should.exist;
        });

        it('should handle pre-configured server with expired certificate', async () => {
            const badConfig = {
                ...config,
                servers: [
                    {
                        name: 'Pre-configured Expired Cert',
                        url: EXPIRED_CERT_URL,
                        order: 0,
                    },
                    ...config.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            fs.writeFileSync(env.configFilePath, JSON.stringify(badConfig));
            await asyncSleep(1000);
            this.app = await env.getApp();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.include('ERR_CERT_DATE_INVALID');
        });

        it('should load pre-configured server with expired certificate when certificate is trusted in CertificateStore', async () => {
            const certificateStorePath = path.join(env.userDataDir, 'certificate.json');

            const certificateStore = {
                [EXPIRED_CERT_URL]: {
                    data: '-----BEGIN CERTIFICATE-----\nMIIFSzCCBDOgAwIBAgIQSueVSfqavj8QDxekeOFpCTANBgkqhkiG9w0BAQsFADCB\nkDELMAkGA1UEBhMCR0IxGzAZBgNVBAgTEkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4G\nA1UEBxMHU2FsZm9yZDEaMBgGA1UEChMRQ09NT0RPIENBIExpbWl0ZWQxNjA0BgNV\nBAMTLUNPTU9ETyBSU0EgRG9tYWluIFZhbGlkYXRpb24gU2VjdXJlIFNlcnZlciBD\nQTAeFw0xNTA0MDkwMDAwMDBaFw0xNTA0MTIyMzU5NTlaMFkxITAfBgNVBAsTGERv\nbWFpbiBDb250cm9sIFZhbGlkYXRlZDEdMBsGA1UECxMUUG9zaXRpdmVTU0wgV2ls\nZGNhcmQxFTATBgNVBAMUDCouYmFkc3NsLmNvbTCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBAMIE7PiM7gTCs9hQ1XBYzJMY61yoaEmwIrX5lZ6xKyx2PmzA\nS2BMTOqytMAPgLaw+XLJhgL5XEFdEyt/ccRLvOmULlA3pmccYYz2QULFRtMWhyef\ndOsKnRFSJiFzbIRMeVXk0WvoBj1IFVKtsyjbqv9u/2CVSndrOfEk0TG23U3AxPxT\nuW1CrbV8/q71FdIzSOciccfCFHpsKOo3St/qbLVytH5aohbcabFXRNsKEqveww9H\ndFxBIuGa+RuT5q0iBikusbpJHAwnnqP7i/dAcgCskgjZjFeEU4EFy+b+a1SYQCeF\nxxC7c3DvaRhBB0VVfPlkPz0sw6l865MaTIbRyoUCAwEAAaOCAdUwggHRMB8GA1Ud\nIwQYMBaAFJCvajqUWgvYkOoSVnPfQ7Q6KNrnMB0GA1UdDgQWBBSd7sF7gQs6R2lx\nGH0RN5O8pRs/+zAOBgNVHQ8BAf8EBAMCBaAwDAYDVR0TAQH/BAIwADAdBgNVHSUE\nFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwTwYDVR0gBEgwRjA6BgsrBgEEAbIxAQIC\nBzArMCkGCCsGAQUFBwIBFh1odHRwczovL3NlY3VyZS5jb21vZG8uY29tL0NQUzAI\nBgZngQwBAgEwVAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5jb21vZG9jYS5j\nb20vQ09NT0RPUlNBRG9tYWluVmFsaWRhdGlvblNlY3VyZVNlcnZlckNBLmNybDCB\nhQYIKwYBBQUHAQEEeTB3ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LmNvbW9kb2Nh\nLmNvbS9DT01PRE9SU0FEb21haW5WYWxpZGF0aW9uU2VjdXJlU2VydmVyQ0EuY3J0\nMCQGCCsGAQUFBzABhhhodHRwOi8vb2NzcC5jb21vZG9jYS5jb20wIwYDVR0RBBww\nGoIMKi5iYWRzc2wuY29tggpiYWRzc2wuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQBq\nevHa/wMHcnjFZqFPRkMOXxQhjHUa6zbgH6QQFezaMyV8O7UKxwE4PSf9WNnM6i1p\nOXy+l+8L1gtY54x/v7NMHfO3kICmNnwUW+wHLQI+G1tjWxWrAPofOxkt3+IjEBEH\nfnJ/4r+3ABuYLyw/zoWaJ4wQIghBK4o+gk783SHGVnRwpDTysUCeK1iiWQ8dSO/r\nET7BSp68ZVVtxqPv1dSWzfGuJ/ekVxQ8lEEFeouhN0fX9X3c+s5vMaKwjOrMEpsi\n8TRwz311SotoKQwe6Zaoz7ASH1wq7mcvf71z81oBIgxw+s1F73hczg36TuHvzmWf\nRwxPuzZEaFZcVlmtqoq8\n-----END CERTIFICATE-----\n',
                    issuerName: 'COMODO RSA Domain Validation Secure Server CA',
                    dontTrust: false,
                },
            };
            fs.writeFileSync(certificateStorePath, JSON.stringify(certificateStore, null, 2));

            const badConfig = {
                ...config,
                servers: [
                    {
                        name: 'Pre-configured Expired Cert Trusted',
                        url: EXPIRED_CERT_URL,
                        order: 0,
                    },
                    ...config.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            fs.writeFileSync(env.configFilePath, JSON.stringify(badConfig));
            await asyncSleep(1000);
            this.app = await env.getApp();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;

            const errorView = await mainWindow.$('.ErrorView');
            (errorView === null).should.be.true;
        });

        it('should handle pre-configured server using TLS 1.1', async () => {
            const badConfig = {
                ...config,
                servers: [
                    {
                        name: 'Pre-configured TLS 1.1',
                        url: TLS_1_1_URL,
                        order: 0,
                    },
                    ...config.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            fs.writeFileSync(env.configFilePath, JSON.stringify(badConfig));
            await asyncSleep(1000);
            this.app = await env.getApp();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.match(/ERR_SSL_(VERSION_OR_CIPHER_MISMATCH|PROTOCOL_ERROR)/);
        });

        it('should handle pre-configured server using RC4 cipher', async () => {
            const badConfig = {
                ...config,
                servers: [
                    {
                        name: 'Pre-configured RC4',
                        url: RC4_CIPHER_URL,
                        order: 0,
                    },
                    ...config.servers.map((s, i) => ({...s, order: i + 1})),
                ],
                lastActiveServer: 0,
            };
            fs.writeFileSync(env.configFilePath, JSON.stringify(badConfig));
            await asyncSleep(1000);
            this.app = await env.getApp();

            const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
            mainWindow.should.exist;
            await mainWindow.waitForSelector('.ErrorView', {timeout: 30000});
            const errorView = await mainWindow.$('.ErrorView');
            errorView.should.exist;

            const errorInfo = await mainWindow.innerText('.ErrorView-techInfo');
            errorInfo.should.match(/ERR_SSL_(OBSOLETE_CIPHER|VERSION_OR_CIPHER_MISMATCH)/);
        });
    });
});

