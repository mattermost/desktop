// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execFile as execFileOriginal} from 'child_process';
import fs from 'fs';
import {promisify} from 'util';

import {shell} from 'electron';
import type {RegistryValue} from 'registry-js';
import {HKEY, enumerateValues} from 'registry-js';

import {Logger} from 'common/log';

const execFile = promisify(execFileOriginal);
const log = new Logger('ExternalBrowserManager');

export interface BrowserInfo {
    name: string;
    executable: string;
    args: string[];
}

// macOS: known browsers with their bundle identifiers (safe — hardcoded values only)
const KNOWN_MACOS_BROWSERS: Array<{name: string; bundleId: string}> = [
    {name: 'Safari', bundleId: 'com.apple.Safari'},
    {name: 'Google Chrome', bundleId: 'com.google.Chrome'},
    {name: 'Firefox', bundleId: 'org.mozilla.firefox'},
    {name: 'Microsoft Edge', bundleId: 'com.microsoft.edgemac'},
    {name: 'Brave Browser', bundleId: 'com.brave.Browser'},
    {name: 'Arc', bundleId: 'company.thebrowser.Browser'},
    {name: 'Opera', bundleId: 'com.operasoftware.Opera'},
    {name: 'Vivaldi', bundleId: 'com.vivaldi.Vivaldi'},
    {name: 'Chromium', bundleId: 'org.chromium.Chromium'},
    {name: 'Orion', bundleId: 'com.kagi.kagimacOS'},
    {name: 'Zen Browser', bundleId: 'app.zen.browser'},
];

// Windows: known browsers with their registry keys under HKLM\SOFTWARE\Clients\StartMenuInternet
const KNOWN_WINDOWS_BROWSERS: Array<{name: string; registryKey: string}> = [
    {name: 'Google Chrome', registryKey: 'Google Chrome'},
    {name: 'Firefox', registryKey: 'FIREFOX.EXE'},
    {name: 'Microsoft Edge', registryKey: 'Microsoft Edge'},
    {name: 'Brave Browser', registryKey: 'Brave'},
    {name: 'Opera', registryKey: 'OperaStable'},
    {name: 'Vivaldi', registryKey: 'Vivaldi'},
    {name: 'Arc', registryKey: 'Arc'},
];

const WINDOWS_REGISTRY_PATH = 'SOFTWARE\\Clients\\StartMenuInternet';
const WINDOWS_REGISTRY_ROOTS = [
    HKEY.HKEY_LOCAL_MACHINE,
    HKEY.HKEY_CURRENT_USER,
];

// Linux: known browsers with their executable names
const KNOWN_LINUX_BROWSERS: Array<{name: string; commands: string[]}> = [
    {name: 'Firefox', commands: ['firefox', 'firefox-esr']},
    {name: 'Google Chrome', commands: ['google-chrome', 'google-chrome-stable']},
    {name: 'Chromium', commands: ['chromium', 'chromium-browser']},
    {name: 'Microsoft Edge', commands: ['microsoft-edge', 'microsoft-edge-stable']},
    {name: 'Brave Browser', commands: ['brave-browser', 'brave-browser-stable']},
    {name: 'Vivaldi', commands: ['vivaldi', 'vivaldi-stable']},
    {name: 'Opera', commands: ['opera']},
    {name: 'Zen Browser', commands: ['zen-browser']},
];

const stripWrappingQuotes = (token: string) => token.replace(/^["']|["']$/g, '');

const tokenizeCommand = (value: string): string[] => {
    return (value.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(stripWrappingQuotes);
};

/**
 * Parse a Windows registry command string (e.g. from shell\open\command).
 * The value may be a quoted path with flags and a %1 placeholder, e.g.:
 *   "C:\Program Files\Browser\browser.exe" --flag %1
 *   C:\Browser\browser.exe
 */
function parseRegistryCommand(raw: string): {executable: string; args: string[]} | null {
    const tokens = tokenizeCommand(raw.trim());
    if (tokens.length === 0) {
        return null;
    }

    const [executable, ...rawArgs] = tokens;
    const args = rawArgs.filter((token) => token && !(/^%(\d|\*)$/).test(token));
    return {executable, args};
}

/**
 * Detects installed external browsers for the current platform and opens links in a selected browser.
 */
export class ExternalBrowserManager {
    private cachedBrowsers: BrowserInfo[] | null = null;
    private loadingBrowsers?: Promise<BrowserInfo[]>;

    init = (): void => {
        this.getInstalledBrowsers();
    };

    getCachedBrowsers = (): BrowserInfo[] => {
        return this.cachedBrowsers || [];
    };

    clearBrowserCache = (): void => {
        this.cachedBrowsers = null;
        this.loadingBrowsers = undefined;
    };

    getInstalledBrowsers = async (): Promise<BrowserInfo[]> => {
        if (this.cachedBrowsers) {
            return this.cachedBrowsers;
        }

        if (!this.loadingBrowsers) {
            this.loadingBrowsers = this.loadInstalledBrowsers().finally(() => {
                this.loadingBrowsers = undefined;
            });
        }

        return this.loadingBrowsers;
    };

    openLinkInBrowser = async (url: string, browser: BrowserInfo): Promise<void> => {
        log.debug('Opening link in external browser', {browser: browser.name});
        try {
            await execFile(browser.executable, [...browser.args, url], {timeout: 10000});
        } catch (execError) {
            log.error('execFile failed to open link, falling back to default browser', {browser: browser.name, error: execError});
            try {
                await shell.openExternal(url);
            } catch (fallbackError) {
                log.error('Fallback shell.openExternal also failed', {browser: browser.name, error: fallbackError});
            }
        }
    };

    private loadInstalledBrowsers = async (): Promise<BrowserInfo[]> => {
        let browsers: BrowserInfo[] = [];

        try {
            switch (process.platform) {
            case 'darwin':
                browsers = await this.getMacOSBrowsers();
                break;
            case 'win32':
                browsers = await this.getWindowsBrowsers();
                break;
            case 'linux':
                browsers = await this.getLinuxBrowsers();
                break;
            default:
                browsers = [];
            }
        } catch (error) {
            log.error('Failed to detect installed browsers', {error});
        }

        this.cachedBrowsers = browsers;
        log.debug('Detected installed browsers', {browsers: browsers.map((browser) => browser.name)});
        return browsers;
    };

    private getMacOSBrowsers = async (): Promise<BrowserInfo[]> => {
        const results = await Promise.all(
            KNOWN_MACOS_BROWSERS.map(async (browser) => {
                try {
                    const {stdout} = await execFile(
                        'mdfind',
                        [`kMDItemCFBundleIdentifier == "${browser.bundleId}"`],
                        {timeout: 5000},
                    );

                    if (stdout.split('\n').some((line) => line.trim().length > 0)) {
                        return {
                            name: browser.name,
                            executable: 'open',
                            args: ['-b', browser.bundleId],
                        };
                    }
                } catch {
                    // browser not found
                }

                return null;
            }),
        );

        return results.filter((browser): browser is BrowserInfo => browser !== null);
    };

    private getWindowsBrowsers = async (): Promise<BrowserInfo[]> => {
        const seenNames = new Set<string>();
        const found: BrowserInfo[] = [];

        for (const hive of WINDOWS_REGISTRY_ROOTS) {
            for (const browser of KNOWN_WINDOWS_BROWSERS) {
                if (seenNames.has(browser.name)) {
                    continue;
                }

                const command = this.getWindowsBrowserCommand(hive, browser.registryKey);
                if (!command) {
                    continue;
                }

                const parsed = parseRegistryCommand(command);
                if (!parsed || !fs.existsSync(parsed.executable)) {
                    continue;
                }

                found.push({
                    name: browser.name,
                    executable: parsed.executable,
                    args: parsed.args,
                });
                seenNames.add(browser.name);
            }
        }

        return found;
    };

    private getWindowsBrowserCommand = (hive: HKEY, registryKey: string): string | undefined => {
        try {
            const values = enumerateValues(hive, `${WINDOWS_REGISTRY_PATH}\\${registryKey}\\shell\\open\\command`);
            const defaultValue = this.findDefaultRegistryValue(values);
            return typeof defaultValue?.data === 'string' ? defaultValue.data : undefined;
        } catch (error) {
            log.debug('Failed to read browser command from registry', {hive, registryKey, error});
            return undefined;
        }
    };

    private findDefaultRegistryValue = (values: readonly RegistryValue[]): RegistryValue | undefined => {
        return values.find((value) => value.name === '') ||
            values.find((value) => value.name === '(Default)') ||
            values.find((value) => typeof value.data === 'string');
    };

    private getLinuxBrowsers = async (): Promise<BrowserInfo[]> => {
        const results: Array<BrowserInfo | null> = await Promise.all(
            KNOWN_LINUX_BROWSERS.map(async (browser) => {
                for (const command of browser.commands) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const {stdout} = await execFile('which', [command], {timeout: 3000});
                        const executable = stdout.split('\n').map((line) => line.trim()).find(Boolean);

                        if (executable && fs.existsSync(executable)) {
                            return {
                                name: browser.name,
                                executable,
                                args: [] as string[],
                            };
                        }
                    } catch {
                        // command not found, try next
                    }
                }

                return null;
            }),
        );

        return results.filter((browser): browser is BrowserInfo => browser !== null);
    };
}

const externalBrowserManager = new ExternalBrowserManager();
export default externalBrowserManager;
