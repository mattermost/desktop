// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {_electron as electron} from 'playwright';

import {test, expect} from '../../fixtures/index';
import {waitForAppReady} from '../../helpers/appReadiness';
import {waitForLockFileRelease} from '../../helpers/cleanup';
import {appDir, demoConfig, electronBinaryPath, exampleURL, mattermostURL, writeConfigFile} from '../../helpers/config';
import {buildServerMap} from '../../helpers/serverMap';

const isSupported = (process.platform === 'win32' || process.platform === 'darwin') && process.env.RUN_POLICY_E2E === 'true';

const WIN_REG_PATH_HKCU = 'HKCU:\\SOFTWARE\\Policies\\Mattermost';
const WIN_REG_PATH_HKLM = 'HKLM:\\SOFTWARE\\Policies\\Mattermost';
const WIN_REG_SERVER_LIST_PATH = `${WIN_REG_PATH_HKCU}\\DefaultServerList`;
const APP_ID = 'com.github.Electron';

type PolicyServer = {
    name: string;
    url: string;
};

type PolicyConfig = {
    servers?: PolicyServer[];
    enableServerManagement?: boolean;
    enableAutoUpdater?: boolean;
};

function escapeXml(value: string) {
    return String(value).replace(/[&<>"']/g, (char) => {
        switch (char) {
        case '&':
            return '&amp;';
        case '<':
            return '&lt;';
        case '>':
            return '&gt;';
        case '"':
            return '&quot;';
        case '\'':
            return '&apos;';
        default:
            return char;
        }
    });
}

function psEncode(script: string) {
    return Buffer.from(script, 'utf16le').toString('base64');
}

function setupPolicy(config: PolicyConfig = {}) {
    if (process.platform === 'win32') {
        setupWindowsPolicy(config);
        return;
    }

    if (process.platform === 'darwin') {
        setupMacOSPolicy(config);
    }
}

function setupWindowsPolicy({servers = [], enableServerManagement, enableAutoUpdater}: PolicyConfig = {}) {
    const run = (script: string) => execFileSync('powershell.exe', [
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-EncodedCommand', psEncode(script),
    ]);

    run(`if (Test-Path -Path '${WIN_REG_PATH_HKCU}') { Remove-Item -Path '${WIN_REG_PATH_HKCU}' -Recurse -Force }`);
    run(`New-Item -Path '${WIN_REG_PATH_HKCU}' -Force | Out-Null`);

    if (servers.length > 0) {
        run(`New-Item -Path '${WIN_REG_SERVER_LIST_PATH}' -Force | Out-Null`);
        for (const {name, url} of servers) {
            const safeName = name.replace(/'/g, "''");
            const safeUrl = url.replace(/'/g, "''");
            run(`New-ItemProperty -Path '${WIN_REG_SERVER_LIST_PATH}' -Name '${safeName}' -Value '${safeUrl}' -PropertyType String -Force | Out-Null`);
        }
    }

    if (enableServerManagement !== undefined) {
        run(`New-ItemProperty -Path '${WIN_REG_PATH_HKCU}' -Name 'EnableServerManagement' -Type DWord -Value ${enableServerManagement ? 1 : 0} -Force | Out-Null`);
    }

    if (enableAutoUpdater !== undefined) {
        run(`New-ItemProperty -Path '${WIN_REG_PATH_HKCU}' -Name 'EnableAutoUpdater' -Type DWord -Value ${enableAutoUpdater ? 1 : 0} -Force | Out-Null`);
    }
}

function setupMacOSPolicy({servers = [], enableServerManagement, enableAutoUpdater}: PolicyConfig = {}) {
    try {
        execFileSync('defaults', ['delete', APP_ID], {stdio: 'ignore'});
    } catch {
        // ignore missing domain
    }

    if (servers.length > 0) {
        const serverDicts = servers.map(({name, url}) =>
            `<dict><key>name</key><string>${escapeXml(name)}</string><key>url</key><string>${escapeXml(url)}</string></dict>`,
        );
        execFileSync('defaults', ['write', APP_ID, 'DefaultServerList', '-array', ...serverDicts]);
    }

    if (enableServerManagement !== undefined) {
        execFileSync('defaults', ['write', APP_ID, 'EnableServerManagement', '-bool', enableServerManagement ? 'true' : 'false']);
    }

    if (enableAutoUpdater !== undefined) {
        execFileSync('defaults', ['write', APP_ID, 'EnableAutoUpdater', '-bool', enableAutoUpdater ? 'true' : 'false']);
    }
}

function isHklmPolicyPresent() {
    if (process.platform !== 'win32') {
        return false;
    }

    try {
        const result = execFileSync('powershell.exe', [
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-EncodedCommand', psEncode(`(Test-Path -Path '${WIN_REG_PATH_HKLM}').ToString()`),
        ], {encoding: 'utf8'});
        return result.trim() === 'True';
    } catch {
        return false;
    }
}

const canRunBaseline = !isHklmPolicyPresent();
const policyTestMetadata = {tag: ['@P2', '@darwin', '@win32']};

function cleanupPolicy() {
    if (process.platform === 'win32') {
        const run = (script: string) => execFileSync('powershell.exe', [
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-EncodedCommand', psEncode(script),
        ]);

        run(`if (Test-Path -Path '${WIN_REG_PATH_HKCU}') { Remove-Item -Path '${WIN_REG_PATH_HKCU}' -Recurse -Force }`);
        try {
            run(`if (Test-Path -Path '${WIN_REG_PATH_HKLM}') { Remove-Item -Path '${WIN_REG_PATH_HKLM}' -Recurse -Force }`);
        } catch {
            // no admin access
        }
        return;
    }

    if (process.platform === 'darwin') {
        try {
            execFileSync('defaults', ['delete', APP_ID], {stdio: 'ignore'});
        } catch {
            // ignore missing domain
        }
    }
}

type LaunchOptions = {
    config?: typeof demoConfig;
    configName?: string;
};

async function launchPolicyApp(testInfo: {outputDir: string}, options: LaunchOptions = {}) {
    const userDataDir = path.join(testInfo.outputDir, options.configName ?? 'policy-userdata');
    fs.mkdirSync(userDataDir, {recursive: true});

    if (options.config) {
        writeConfigFile(userDataDir, options.config);
    }

    const app = await electron.launch({
        executablePath: electronBinaryPath,
        args: [appDir, `--user-data-dir=${userDataDir}`, '--no-sandbox', '--disable-gpu'],
        env: {...process.env, NODE_ENV: 'test'},
        timeout: 60_000,
    });

    await waitForAppReady(app);
    return {app, userDataDir};
}

async function closePolicyApp(app: Awaited<ReturnType<typeof electron.launch>> | undefined, userDataDir: string) {
    await app?.close().catch(() => {});
    await waitForLockFileRelease(userDataDir).catch(() => {});
}

async function getMainWindow(app: Awaited<ReturnType<typeof electron.launch>>) {
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    expect(mainWindow, 'Main window should exist').toBeDefined();
    await mainWindow!.waitForLoadState().catch(() => {});
    return mainWindow!;
}

async function openServerDropdown(app: Awaited<ReturnType<typeof electron.launch>>) {
    const mainWindow = await getMainWindow(app);
    await mainWindow.click('.ServerDropdownButton');

    const existing = app.windows().find((window) => {
        try {
            return window.url().includes('dropdown');
        } catch {
            return false;
        }
    });

    if (existing) {
        await existing.waitForLoadState().catch(() => {});
        return existing;
    }

    const dropdownWindow = await app.waitForEvent('window', {
        predicate: (window) => {
            try {
                return window.url().includes('dropdown');
            } catch {
                return false;
            }
        },
        timeout: 10_000,
    });
    await dropdownWindow.waitForLoadState().catch(() => {});
    return dropdownWindow;
}

test.describe('policy', () => {
    test.describe.configure({mode: 'serial'});

    test.afterEach(() => {
        cleanupPolicy();
    });

    test('MM-T_GPO_1 should display the predefined server name in the dropdown button', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        const policyServer = {name: 'Policy Server', url: mattermostURL};
        setupPolicy({servers: [policyServer]});

        const {app, userDataDir} = await launchPolicyApp(testInfo, {configName: 'policy-default-server'});
        try {
            const mainWindow = await getMainWindow(app);

            // Wait for the dropdown button to render before reading its text.
            await mainWindow.waitForSelector('.ServerDropdownButton', {timeout: 15_000});
            const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
            expect(dropdownButtonText).toBe(policyServer.name);
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_2 should load the predefined server URL in a BrowserView', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        const policyServer = {name: 'Policy Server', url: mattermostURL};
        setupPolicy({servers: [policyServer]});

        const {app, userDataDir} = await launchPolicyApp(testInfo, {configName: 'policy-server-view'});
        try {
            const serverMap = await buildServerMap(app);
            expect(serverMap).toHaveProperty(policyServer.name);
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_3 should hide the Add Server button when server management is disabled by policy', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        setupPolicy({
            servers: [{name: 'Managed Server', url: mattermostURL}],
            enableServerManagement: false,
        });

        const {app, userDataDir} = await launchPolicyApp(testInfo, {configName: 'policy-server-management-off'});
        try {
            const dropdownWindow = await openServerDropdown(app);
            await expect(dropdownWindow.locator('.ServerDropdown__button.addServer')).toHaveCount(0);
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_NP_1 should show the welcome screen when no policy and no config exist', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        test.skip(!canRunBaseline, 'Baseline policy tests require no HKLM policy');

        cleanupPolicy();
        const {app, userDataDir} = await launchPolicyApp(testInfo, {configName: 'policy-no-config'});
        try {
            let welcomeWindow = app.windows().find((window) => window.url().includes('welcomeScreen'));
            if (!welcomeWindow) {
                welcomeWindow = await app.waitForEvent('window', {
                    predicate: (window) => window.url().includes('welcomeScreen'),
                    timeout: 10_000,
                });
            }
            await welcomeWindow.waitForLoadState('domcontentloaded');
            const buttonText = await welcomeWindow.innerText('.WelcomeScreen .WelcomeScreen__button');
            expect(buttonText).toBe('Get Started');
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_NP_2 should show the Add Server button when no policy restricts server management', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        test.skip(!canRunBaseline, 'Baseline policy tests require no HKLM policy');

        cleanupPolicy();
        const {app, userDataDir} = await launchPolicyApp(testInfo, {
            configName: 'policy-no-restriction',
            config: demoConfig,
        });
        try {
            const dropdownWindow = await openServerDropdown(app);
            await expect(dropdownWindow.locator('.ServerDropdown__button.addServer')).toHaveCount(1);
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_5 should display all predefined servers from policy in the dropdown', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        const policyServers = [
            {name: 'Policy Server 1', url: mattermostURL},
            {name: 'Policy Server 2', url: exampleURL},
        ];
        setupPolicy({servers: policyServers});

        const {app, userDataDir} = await launchPolicyApp(testInfo, {configName: 'policy-multiple-servers'});
        try {
            const dropdownWindow = await openServerDropdown(app);
            const serverButtons = dropdownWindow.locator('.ServerDropdown__button:not(.addServer)');
            await expect(serverButtons).toHaveCount(policyServers.length);
            const texts = await serverButtons.allInnerTexts();
            for (const {name} of policyServers) {
                expect(texts.some((text) => text.includes(name))).toBe(true);
            }
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_6 should show edit button but hide remove button for a predefined policy server', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        setupPolicy({
            servers: [{name: 'Managed Server', url: mattermostURL}],
            enableServerManagement: false,
        });

        const {app, userDataDir} = await launchPolicyApp(testInfo, {configName: 'policy-edit-remove'});
        try {
            const dropdownWindow = await openServerDropdown(app);
            await expect(dropdownWindow.locator('.ServerDropdown__button-edit')).toHaveCount(1);
            await expect(dropdownWindow.locator('.ServerDropdown__button-remove')).toHaveCount(0);
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_7 should display both the policy server and the user-configured server in the dropdown', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        const policyServer = {name: 'Policy Server', url: mattermostURL};
        setupPolicy({servers: [policyServer]});

        const coexistConfig = {
            ...demoConfig,
            servers: [{name: 'example', url: exampleURL, order: 0}],
        };

        const {app, userDataDir} = await launchPolicyApp(testInfo, {
            configName: 'policy-coexistence',
            config: coexistConfig,
        });
        try {
            const dropdownWindow = await openServerDropdown(app);
            const serverButtons = dropdownWindow.locator('.ServerDropdown__button:not(.addServer)');
            await expect(serverButtons).toHaveCount(2);
            const texts = await serverButtons.allInnerTexts();
            expect(texts.some((text) => text.includes(policyServer.name))).toBe(true);
            expect(texts.some((text) => text.includes('example'))).toBe(true);
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });

    test('MM-T_GPO_4 should report enableUpdateNotifications=false when auto-updater is disabled by policy', policyTestMetadata, async ({}, testInfo) => {
        test.skip(!isSupported, 'RUN_POLICY_E2E=true on macOS/Windows required');
        setupPolicy({enableAutoUpdater: false});

        const {app, userDataDir} = await launchPolicyApp(testInfo, {configName: 'policy-auto-updater'});
        try {
            const mainWindow = await getMainWindow(app);
            const config = await mainWindow.evaluate(() => window.desktop.getConfiguration());
            expect(config.enableUpdateNotifications).toBe(false);
        } finally {
            await closePolicyApp(app, userDataDir);
        }
    });
});
