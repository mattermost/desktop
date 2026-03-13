// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const {execFileSync} = require('child_process');
const fs = require('fs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

// Policy tests only run on Windows and macOS — Linux has no policyConfigLoader support.
// Additionally, they are gated behind RUN_POLICY_E2E to avoid modifying developer machines unintentionally.
const isSupported = env.isOneOf(['win32', 'darwin']) && process.env.RUN_POLICY_E2E === 'true';

// Windows registry paths (match policyConfigLoader.ts WINDOWS_REGISTRY_PATH).
// Tests write to HKCU (no admin required). Cleanup also attempts HKLM so that
// a pre-GPO-configured runner doesn't pollute the no-policy baseline tests.
const WIN_REG_PATH_HKCU = 'HKCU:\\SOFTWARE\\Policies\\Mattermost';
const WIN_REG_PATH_HKLM = 'HKLM:\\SOFTWARE\\Policies\\Mattermost';
const WIN_REG_SERVER_LIST_PATH = `${WIN_REG_PATH_HKCU}\\DefaultServerList`;

// macOS CFPreferences domain used by policyConfigLoader.
// NOTE: 'com.github.Electron' is the bundle ID for unpackaged/dev builds. Production
// builds use 'com.mattermost.desktop' — these tests must run against an unpackaged app.
const APP_ID = 'com.github.Electron';

// Escape XML special characters for use in plist fragments passed to `defaults write`.
function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => {
        switch (ch) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\'': return '&apos;';
        default: return ch;
        }
    });
}

/**
 * Encode a PowerShell script as a Base64 UTF-16LE string for -EncodedCommand.
 * This avoids all single-quote / metacharacter escaping issues when interpolating
 * arbitrary values (e.g. server URLs containing '&', "'", etc.) into PS scripts.
 */
function psEncode(script) {
    return Buffer.from(script, 'utf16le').toString('base64');
}

/**
 * Write OS-level policy configuration before the Electron app launches.
 *
 * @param {object} config
 * @param {Array<{name: string, url: string}>} [config.servers]
 * @param {boolean} [config.enableServerManagement]
 * @param {boolean} [config.enableAutoUpdater]
 */
function setupPolicy(config = {}) {
    if (process.platform === 'win32') {
        setupWindowsPolicy(config);
    } else if (process.platform === 'darwin') {
        setupMacOSPolicy(config);
    }
}

function setupWindowsPolicy({servers = [], enableServerManagement, enableAutoUpdater} = {}) {
    const ps = 'powershell.exe';
    const run = (script) => execFileSync(ps, ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', psEncode(script)]);

    // Remove any pre-existing Mattermost policy key (HKCU only — tests run without admin)
    // so stale values from a previous run don't bleed into this test.
    run(`Remove-Item -Path '${WIN_REG_PATH_HKCU}' -Recurse -Force -ErrorAction SilentlyContinue`);
    run(`New-Item -Path '${WIN_REG_PATH_HKCU}' -Force | Out-Null`);

    if (servers.length > 0) {
        run(`New-Item -Path '${WIN_REG_SERVER_LIST_PATH}' -Force | Out-Null`);
        for (const {name, url} of servers) {
            // Escape single quotes for PowerShell single-quoted string literals
            const safeName = name.replace(/'/g, "''");
            const safeUrl = url.replace(/'/g, "''");
            run(`New-ItemProperty -Path '${WIN_REG_SERVER_LIST_PATH}' -Name '${safeName}' -Value '${safeUrl}' -PropertyType String -Force | Out-Null`);
        }
    }

    if (enableServerManagement !== undefined) {
        const val = enableServerManagement ? 1 : 0;
        run(`New-ItemProperty -Path '${WIN_REG_PATH_HKCU}' -Name 'EnableServerManagement' -Type DWord -Value ${val} -Force | Out-Null`);
    }

    if (enableAutoUpdater !== undefined) {
        const val = enableAutoUpdater ? 1 : 0;
        run(`New-ItemProperty -Path '${WIN_REG_PATH_HKCU}' -Name 'EnableAutoUpdater' -Type DWord -Value ${val} -Force | Out-Null`);
    }
}

function setupMacOSPolicy({servers = [], enableServerManagement, enableAutoUpdater} = {}) {
    // Use `defaults write` instead of writing raw plist XML so that changes go
    // through the CFPreferences daemon — this avoids cache staleness issues where
    // CFPreferencesCopyAppValue returns the old (empty) value even after the plist
    // file has been written to disk.

    // First delete any stale preferences so we start clean.
    try {
        execFileSync('defaults', ['delete', APP_ID], {stdio: 'ignore'});
    } catch (err) {
        // Ignore — domain may not exist yet.
    }

    // Write DefaultServerList as an XML-format array using `defaults write`.
    // Each server dict is written as a plist fragment accepted by `defaults write -array`.
    if (servers.length > 0) {
        const serverDicts = servers.map(({name, url}) => {
            const escapedName = escapeXml(name);
            const escapedUrl = escapeXml(url);
            return `<dict><key>name</key><string>${escapedName}</string><key>url</key><string>${escapedUrl}</string></dict>`;
        });
        execFileSync('defaults', ['write', APP_ID, 'DefaultServerList', '-array', ...serverDicts]);
    }

    if (enableServerManagement !== undefined) {
        execFileSync('defaults', ['write', APP_ID, 'EnableServerManagement', '-bool', enableServerManagement ? 'true' : 'false']);
    }

    if (enableAutoUpdater !== undefined) {
        execFileSync('defaults', ['write', APP_ID, 'EnableAutoUpdater', '-bool', enableAutoUpdater ? 'true' : 'false']);
    }
}

/**
 * Check whether a Mattermost policy key exists in HKLM (machine-scope GPO).
 * On a domain-joined machine with real GPO applied, this will return true and
 * the no-policy baseline tests must be skipped — they cannot clean HKLM without admin.
 * GitHub Actions Windows runners are NOT domain-joined, so this returns false there.
 */
function isHklmPolicyPresent() {
    if (process.platform !== 'win32') {
        return false;
    }
    try {
        const ps = 'powershell.exe';
        const result = execFileSync(ps, [
            '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand',
            psEncode(`(Test-Path -Path '${WIN_REG_PATH_HKLM}').ToString()`),
        ], {encoding: 'utf8'});
        return result.trim() === 'True';
    } catch (err) {
        return false;
    }
}

// True only when no machine-scope GPO is present — baseline tests are only valid in this state.
const canRunBaseline = !isHklmPolicyPresent();

/** Remove OS-level policy configuration after each test. */
function cleanupPolicy() {
    if (process.platform === 'win32') {
        const ps = 'powershell.exe';
        const run = (script) => execFileSync(ps, ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', psEncode(script)]);

        // Always remove HKCU (tests write here, no admin needed).
        run(`Remove-Item -Path '${WIN_REG_PATH_HKCU}' -Recurse -Force -ErrorAction SilentlyContinue`);

        // Attempt HKLM removal (requires admin — silently ignore if access is denied).
        // policyConfigLoader reads both hives, so HKLM values would pollute the
        // no-policy baseline tests on a real GPO-configured machine.
        try {
            run(`Remove-Item -Path '${WIN_REG_PATH_HKLM}' -Recurse -Force -ErrorAction SilentlyContinue`);
        } catch (err) {
            // Not an admin — can't remove HKLM. Check if values are actually present.
        }

        // If HKLM still has values after cleanup (requires admin to remove), the
        // canRunBaseline flag will already have excluded the baseline suites from running.
    } else if (process.platform === 'darwin') {
        try {
            execFileSync('defaults', ['delete', APP_ID], {stdio: 'ignore'});
        } catch (err) {
            // Ignore — domain may not exist
        }
    }
}

// ---------------------------------------------------------------------------
// Suite A — DefaultServerList: predefined servers appear in the dropdown
// ---------------------------------------------------------------------------
(isSupported ? describe : describe.skip)('MM-T_GPO_DefaultServerList - Predefined servers from policy appear in the app', function desc() {
    this.timeout(60000);

    const policyServer = {
        name: 'Policy Server',
        url: env.mattermostURL,
    };

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        setupPolicy({servers: [policyServer]});
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
        cleanupPolicy();
    });

    after(() => {
        cleanupPolicy();
    });

    it('MM-T_GPO_1 should display the predefined server name in the dropdown button', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        const dropdownButtonText = await mainWindow.innerText('.ServerDropdownButton');
        dropdownButtonText.should.equal(policyServer.name);
    });

    it('MM-T_GPO_2 should load the predefined server URL in a BrowserView', async () => {
        this.serverMap = await env.getServerMap(this.app);
        this.serverMap.should.have.property(policyServer.name);
    });
});

// ---------------------------------------------------------------------------
// Suite B — EnableServerManagement=false: add/edit/remove controls hidden
// ---------------------------------------------------------------------------
(isSupported ? describe : describe.skip)('MM-T_GPO_EnableServerManagement - Server management disabled by policy', function desc() {
    this.timeout(60000);

    const policyServer = {
        name: 'Managed Server',
        url: env.mattermostURL,
    };

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        setupPolicy({servers: [policyServer], enableServerManagement: false});
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
        cleanupPolicy();
    });

    after(() => {
        cleanupPolicy();
    });

    it('MM-T_GPO_3 should hide the Add Server button when server management is disabled by policy', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        await mainWindow.click('.ServerDropdownButton');

        // Wait for the dropdown window to appear — it may not be in the list immediately after the click.
        let dropdownWindow;
        const deadline = Date.now() + 5000;
        while (!dropdownWindow && Date.now() < deadline) {
            dropdownWindow = this.app.windows().find((window) => window.url().includes('dropdown'));
            if (!dropdownWindow) {
                // eslint-disable-next-line no-await-in-loop
                await asyncSleep(100);
            }
        }
        dropdownWindow.should.be.ok;

        // The Add Server button should not be present when enableServerManagement=false
        const addServerVisible = await dropdownWindow.isVisible('.ServerDropdown__button.addServer');
        addServerVisible.should.be.false;
    });
});

// ---------------------------------------------------------------------------
// Suite D — No-Policy: welcome screen shown when no servers or policy exist
// ---------------------------------------------------------------------------
// This baseline test is the inverse of Suite A. It confirms that when the OS
// has NO Mattermost policy keys and no local config, the app shows the welcome
// screen — not a server loaded from a stale policy key on the CI runner.
(isSupported && canRunBaseline ? describe : describe.skip)('MM-T_GPO_NoPolicySuite - No-policy baseline: default app behaviour without GPO/MDM', function desc() {
    this.timeout(60000);

    beforeEach(async () => {
        // Guarantee no OS policy exists before the app starts.
        cleanupPolicy();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
    });

    it('MM-T_GPO_NP_1 should show the welcome screen when no policy and no config exist', async () => {
        // If a stale policy key is present on the runner, the app skips the welcome
        // screen and shows the server dropdown instead — this test will catch it.
        let welcomeScreenModal = this.app.windows().find((window) => window.url().includes('welcomeScreen'));
        if (!welcomeScreenModal) {
            welcomeScreenModal = await this.app.waitForEvent('window', {
                predicate: (window) => window.url().includes('welcomeScreen'),
                timeout: 10000,
            });
        }
        await welcomeScreenModal.waitForLoadState('domcontentloaded');

        const buttonText = await welcomeScreenModal.innerText('.WelcomeScreen .WelcomeScreen__button');
        buttonText.should.equal('Get Started');
    });
});

// ---------------------------------------------------------------------------
// Suite E — No-Policy: server management controls visible by default
// ---------------------------------------------------------------------------
// Baseline for Suite B (EnableServerManagement=false). Confirms the Add Server
// button IS visible when no policy is applied — proving Suite B's assertion that
// it disappears under policy is not vacuous.
(isSupported && canRunBaseline ? describe : describe.skip)('MM-T_GPO_NoPolicyServerMgmt - No-policy baseline: server management enabled by default', function desc() {
    this.timeout(60000);

    beforeEach(async () => {
        cleanupPolicy();
        env.createTestUserDataDir();
        env.cleanTestConfig();

        // Write demoConfig so the app starts with servers (skips welcome screen).
        fs.writeFileSync(env.configFilePath, JSON.stringify(env.demoConfig));
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
    });

    it('MM-T_GPO_NP_2 should show the Add Server button when no policy restricts server management', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        await mainWindow.click('.ServerDropdownButton');

        let dropdownWindow;
        const deadline = Date.now() + 5000;
        while (!dropdownWindow && Date.now() < deadline) {
            dropdownWindow = this.app.windows().find((window) => window.url().includes('dropdown'));
            if (!dropdownWindow) {
                // eslint-disable-next-line no-await-in-loop
                await asyncSleep(100);
            }
        }
        dropdownWindow.should.be.ok;

        const addServerVisible = await dropdownWindow.isVisible('.ServerDropdown__button.addServer');
        addServerVisible.should.be.true;
    });
});

// ---------------------------------------------------------------------------
// Suite F — DefaultServerList with multiple servers
// ---------------------------------------------------------------------------
(isSupported ? describe : describe.skip)('MM-T_GPO_MultipleServers - Multiple predefined servers from policy appear in the dropdown', function desc() {
    this.timeout(60000);

    const policyServers = [
        {name: 'Policy Server 1', url: env.mattermostURL},
        {name: 'Policy Server 2', url: env.exampleURL},
    ];

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        setupPolicy({servers: policyServers});
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
        cleanupPolicy();
    });

    after(() => {
        cleanupPolicy();
    });

    it('MM-T_GPO_5 should display all predefined servers from policy in the dropdown', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        await mainWindow.click('.ServerDropdownButton');

        let dropdownWindow;
        const deadline = Date.now() + 5000;
        while (!dropdownWindow && Date.now() < deadline) {
            dropdownWindow = this.app.windows().find((window) => window.url().includes('dropdown'));
            if (!dropdownWindow) {
                // eslint-disable-next-line no-await-in-loop
                await asyncSleep(100);
            }
        }
        dropdownWindow.should.be.ok;

        // All policy-provided servers should appear as entries (excluding the Add Server button)
        const serverButtons = await dropdownWindow.$$('.ServerDropdown__button:not(.addServer)');
        serverButtons.length.should.equal(policyServers.length);

        const serverNames = await Promise.all(serverButtons.map((btn) => btn.innerText()));
        for (const {name} of policyServers) {
            serverNames.some((text) => text.includes(name)).should.be.true;
        }
    });
});

// ---------------------------------------------------------------------------
// Suite G — Edit/Remove button visibility when EnableServerManagement=false
// ---------------------------------------------------------------------------
(isSupported ? describe : describe.skip)('MM-T_GPO_EditRemoveWithPolicy - Edit/remove visibility for predefined policy server with management disabled', function desc() {
    this.timeout(60000);

    const policyServer = {
        name: 'Managed Server',
        url: env.mattermostURL,
    };

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        setupPolicy({servers: [policyServer], enableServerManagement: false});
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
        cleanupPolicy();
    });

    after(() => {
        cleanupPolicy();
    });

    it('MM-T_GPO_6 should show edit button but hide remove button for a predefined policy server', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        await mainWindow.click('.ServerDropdownButton');

        let dropdownWindow;
        const deadline = Date.now() + 5000;
        while (!dropdownWindow && Date.now() < deadline) {
            dropdownWindow = this.app.windows().find((window) => window.url().includes('dropdown'));
            if (!dropdownWindow) {
                // eslint-disable-next-line no-await-in-loop
                await asyncSleep(100);
            }
        }
        dropdownWindow.should.be.ok;

        // Edit button is always rendered regardless of enableServerManagement
        const editVisible = await dropdownWindow.isVisible('.ServerDropdown__button-edit');
        editVisible.should.be.true;

        // Remove button is NOT rendered for predefined (policy-managed) servers
        const removeVisible = await dropdownWindow.isVisible('.ServerDropdown__button-remove');
        removeVisible.should.be.false;
    });
});

// ---------------------------------------------------------------------------
// Suite H — Policy servers coexist with user-configured servers
// ---------------------------------------------------------------------------
(isSupported ? describe : describe.skip)('MM-T_GPO_PolicyCoexistence - Policy servers coexist with user-configured servers', function desc() {
    this.timeout(60000);

    const policyServer = {name: 'Policy Server', url: env.mattermostURL};

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();

        // Write user config with one server so the app skips the welcome screen
        fs.writeFileSync(env.configFilePath, JSON.stringify({
            ...env.demoConfig,
            servers: [{name: 'example', url: env.exampleURL, order: 0}],
        }));

        // Apply a policy server alongside the user-configured one
        setupPolicy({servers: [policyServer]});
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
        cleanupPolicy();
    });

    after(() => {
        cleanupPolicy();
    });

    it('MM-T_GPO_7 should display both the policy server and the user-configured server in the dropdown', async () => {
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));
        await mainWindow.click('.ServerDropdownButton');

        let dropdownWindow;
        const deadline = Date.now() + 5000;
        while (!dropdownWindow && Date.now() < deadline) {
            dropdownWindow = this.app.windows().find((window) => window.url().includes('dropdown'));
            if (!dropdownWindow) {
                // eslint-disable-next-line no-await-in-loop
                await asyncSleep(100);
            }
        }
        dropdownWindow.should.be.ok;

        // Both the policy server and the user-configured server should appear
        const serverButtons = await dropdownWindow.$$('.ServerDropdown__button:not(.addServer)');
        serverButtons.length.should.equal(2);

        const serverNames = await Promise.all(serverButtons.map((btn) => btn.innerText()));
        serverNames.some((text) => text.includes(policyServer.name)).should.be.true;
        serverNames.some((text) => text.includes('example')).should.be.true;
    });
});

// ---------------------------------------------------------------------------
// Suite C — EnableAutoUpdater=false: update notifications suppressed
// ---------------------------------------------------------------------------
(isSupported ? describe : describe.skip)('MM-T_GPO_EnableAutoUpdater - Auto-updater disabled by policy', function desc() {
    this.timeout(60000);

    beforeEach(async () => {
        env.createTestUserDataDir();
        env.cleanTestConfig();
        setupPolicy({enableAutoUpdater: false});
        await asyncSleep(500);
        this.app = await env.getApp();
        await asyncSleep(1000);
    });

    afterEach(async () => {
        if (this.app) {
            try {
                await this.app.close();
            } catch (err) {
                // ignore
            }
        }
        await env.clearElectronInstances();
        cleanupPolicy();
    });

    after(() => {
        cleanupPolicy();
    });

    it('MM-T_GPO_4 should report enableUpdateNotifications=false when auto-updater is disabled by policy', async () => {
        // The update badge is suppressed in NODE_ENV=test regardless of policy, so we assert on the
        // merged configuration value that the app exposes via IPC. This directly validates that
        // policyConfigLoader applied EnableAutoUpdater=false to the combined config.
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));

        const config = await mainWindow.evaluate(() => window.desktop.getConfiguration());
        config.enableUpdateNotifications.should.be.false;
    });
});
