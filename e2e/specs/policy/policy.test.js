// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

// Policy tests only run on Windows and macOS — Linux has no policyConfigLoader support.
const isSupported = env.isOneOf(['win32', 'darwin']);

// Windows registry path (matches policyConfigLoader.ts WINDOWS_REGISTRY_PATH)
const WIN_REG_PATH = 'HKCU:\\SOFTWARE\\Policies\\Mattermost';
const WIN_REG_SERVER_LIST_PATH = `${WIN_REG_PATH}\\DefaultServerList`;

// macOS CFPreferences path.
//
// cf-prefs calls CFPreferencesCopyAppValue with kCFPreferencesCurrentApplication.
// In E2E tests the app runs as the raw Electron binary whose bundle ID is
// "com.github.Electron", so CFPreferences reads from ~/Library/Preferences/
// — no sudo required.  In a production install (bundle ID "Mattermost.Desktop")
// the MDM-managed path would be /Library/Managed Preferences/Mattermost.Desktop.plist,
// but that requires root and is not needed for functional test coverage.
const MACOS_PLIST_PATH = path.join(
    os.homedir(),
    'Library',
    'Preferences',
    'com.github.Electron.plist',
);

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
    // Build a plist XML string from test-controlled data (not user input).
    const serverListXML = servers.map(({name, url}) => `
        <dict>
            <key>name</key>
            <string>${name}</string>
            <key>url</key>
            <string>${url}</string>
        </dict>`).join('');

    const enableServerManagementXML = enableServerManagement !== undefined
        ? `\t<key>EnableServerManagement</key>\n\t${enableServerManagement ? '<true/>' : '<false/>'}\n`
        : '';

    const enableAutoUpdaterXML = enableAutoUpdater !== undefined
        ? `\t<key>EnableAutoUpdater</key>\n\t${enableAutoUpdater ? '<true/>' : '<false/>'}\n`
        : '';

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>DefaultServerList</key>
\t<array>${serverListXML}
\t</array>
${enableServerManagementXML}${enableAutoUpdaterXML}</dict>
</plist>
`;

    // ~/Library/Preferences/ is user-writable — no sudo required.
    fs.mkdirSync(path.dirname(MACOS_PLIST_PATH), {recursive: true});
    fs.writeFileSync(MACOS_PLIST_PATH, plistContent, 'utf8');

    // Tell the OS to reload preferences from disk so the change is visible
    // to CFPreferencesCopyAppValue immediately (macOS caches prefs aggressively).
    try {
        execFileSync('defaults', ['read', 'com.github.Electron'], {stdio: 'ignore'});
    } catch (err) {
        // defaults read may fail if the plist format isn't recognized yet; ignore.
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
            fs.unlinkSync(MACOS_PLIST_PATH);
        } catch (err) {
            // Ignore — file may not exist
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
