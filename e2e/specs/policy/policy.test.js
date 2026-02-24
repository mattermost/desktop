// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const {execFileSync} = require('child_process');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

// Policy tests only run on Windows and macOS — Linux has no policyConfigLoader support.
const isSupported = env.isOneOf(['win32', 'darwin']);

// Windows registry path (matches policyConfigLoader.ts WINDOWS_REGISTRY_PATH)
const WIN_REG_PATH = 'HKCU:\\SOFTWARE\\Policies\\Mattermost';
const WIN_REG_SERVER_LIST_PATH = `${WIN_REG_PATH}\\DefaultServerList`;

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
    // Use powershell.exe with -Command and a script block to avoid shell injection.
    // Each call passes a self-contained script string with no external string interpolation
    // beyond the fixed registry paths and typed values.
    const ps = 'powershell.exe';

    execFileSync(ps, ['-NonInteractive', '-Command', `New-Item -Path '${WIN_REG_PATH}' -Force | Out-Null`]);

    if (servers.length > 0) {
        execFileSync(ps, ['-NonInteractive', '-Command', `New-Item -Path '${WIN_REG_SERVER_LIST_PATH}' -Force | Out-Null`]);
        for (const {name, url} of servers) {
            // Build the script as a single string — name/url are controlled test constants, not user input.
            const script = `New-ItemProperty -Path '${WIN_REG_SERVER_LIST_PATH}' -Name '${name}' -Value '${url}' -PropertyType String -Force | Out-Null`;
            execFileSync(ps, ['-NonInteractive', '-Command', script]);
        }
    }

    if (enableServerManagement !== undefined) {
        const val = enableServerManagement ? '1' : '0';
        const script = `New-ItemProperty -Path '${WIN_REG_PATH}' -Name 'EnableServerManagement' -Type DWord -Value ${val} -Force | Out-Null`;
        execFileSync(ps, ['-NonInteractive', '-Command', script]);
    }

    if (enableAutoUpdater !== undefined) {
        const val = enableAutoUpdater ? '1' : '0';
        const script = `New-ItemProperty -Path '${WIN_REG_PATH}' -Name 'EnableAutoUpdater' -Type DWord -Value ${val} -Force | Out-Null`;
        execFileSync(ps, ['-NonInteractive', '-Command', script]);
    }
}

function setupMacOSPolicy({servers = [], enableServerManagement, enableAutoUpdater} = {}) {
    // Use `defaults write` instead of writing raw plist XML so that changes go
    // through the CFPreferences daemon — this avoids cache staleness issues where
    // CFPreferencesCopyAppValue returns the old (empty) value even after the plist
    // file has been written to disk.

    const APP_ID = 'com.github.Electron';

    // First delete any stale preferences so we start clean.
    try {
        execFileSync('defaults', ['delete', APP_ID], {stdio: 'ignore'});
    } catch (err) {
        // Ignore — domain may not exist yet.
    }

    // Write DefaultServerList as an XML-format array using `defaults write`.
    // Each server dict is written as a plist fragment accepted by `defaults write -array`.
    if (servers.length > 0) {
        const serverDicts = servers.map(({name, url}) =>
            `<dict><key>name</key><string>${name}</string><key>url</key><string>${url}</string></dict>`,
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

/** Remove OS-level policy configuration after each test. */
function cleanupPolicy() {
    if (process.platform === 'win32') {
        try {
            execFileSync('powershell.exe', [
                '-NonInteractive', '-Command',
                `Remove-Item -Path '${WIN_REG_PATH}' -Recurse -Force -ErrorAction SilentlyContinue`,
            ]);
        } catch (err) {
            // Ignore — key may not exist
        }
    } else if (process.platform === 'darwin') {
        try {
            execFileSync('defaults', ['delete', 'com.github.Electron'], {stdio: 'ignore'});
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

    it('MM-T_GPO_4 should report enableUpdateNotifications=false when auto-updater is disabled by policy', async () => {
        // The update badge is suppressed in NODE_ENV=test regardless of policy, so we assert on the
        // merged configuration value that the app exposes via IPC. This directly validates that
        // policyConfigLoader applied EnableAutoUpdater=false to the combined config.
        const mainWindow = this.app.windows().find((window) => window.url().includes('index'));

        const config = await mainWindow.evaluate(() => window.desktop.getConfiguration());
        config.enableUpdateNotifications.should.be.false;
    });
});
