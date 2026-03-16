// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {exec as execOriginal} from 'child_process';
import fs from 'fs';
import {promisify} from 'util';

import {shell} from 'electron';

import {Logger} from 'common/log';

const exec = promisify(execOriginal);
const log = new Logger('BrowserManager');

export interface BrowserInfo {
    name: string;
    command: string;
}

// macOS: known browsers with their bundle identifiers
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

let cachedBrowsers: BrowserInfo[] | null = null;

// macOS detection via mdfind (Spotlight)
async function getMacOSBrowsers(): Promise<BrowserInfo[]> {
    const results = await Promise.all(
        KNOWN_MACOS_BROWSERS.map(async (browser) => {
            try {
                const {stdout} = await exec(
                    `mdfind "kMDItemCFBundleIdentifier == '${browser.bundleId}'" | head -1`,
                    {timeout: 5000},
                );
                if (stdout.trim().length > 0) {
                    return {
                        name: browser.name,
                        command: `open -b "${browser.bundleId}"`,
                    };
                }
            } catch {
                // browser not found
            }
            return null;
        }),
    );
    return results.filter((b): b is BrowserInfo => b !== null);
}

// Windows detection via registry
async function getWindowsBrowsers(): Promise<BrowserInfo[]> {
    const results = await Promise.all(
        KNOWN_WINDOWS_BROWSERS.map(async (browser) => {
            try {
                const {stdout} = await exec(
                    `reg query "HKLM\\SOFTWARE\\Clients\\StartMenuInternet\\${browser.registryKey}\\shell\\open\\command" /ve`,
                    {timeout: 5000},
                );

                // Registry output contains REG_SZ followed by the path in quotes
                const match = stdout.match(/REG_SZ\s+(.+)/);
                if (match) {
                    const browserPath = match[1].trim().replace(/^"(.*)"$/, '$1');
                    if (fs.existsSync(browserPath)) {
                        return {
                            name: browser.name,
                            command: `"${browserPath}"`,
                        };
                    }
                }
            } catch {
                // browser not found in registry
            }
            return null;
        }),
    );
    return results.filter((b): b is BrowserInfo => b !== null);
}

// Linux detection via which + .desktop files
async function getLinuxBrowsers(): Promise<BrowserInfo[]> {
    const seenNames = new Set<string>();

    // Check known browsers in parallel — for each browser, try its commands sequentially
    const knownResults = await Promise.all(
        KNOWN_LINUX_BROWSERS.map(async (browser) => {
            for (const cmd of browser.commands) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const {stdout} = await exec(`which ${cmd}`, {timeout: 3000});
                    if (stdout.trim().length > 0) {
                        return {name: browser.name, command: cmd};
                    }
                } catch {
                    // command not found, try next
                }
            }
            return null;
        }),
    );

    const found: BrowserInfo[] = [];
    for (const result of knownResults) {
        if (result && !seenNames.has(result.name)) {
            found.push(result);
            seenNames.add(result.name);
        }
    }

    // Also discover browsers from .desktop files that handle http(s)
    try {
        const {stdout} = await exec(
            'grep -rl "x-scheme-handler/https" /usr/share/applications/ 2>/dev/null || true',
            {timeout: 5000},
        );
        const desktopFiles = stdout.trim().split('\n').filter(Boolean);
        for (const file of desktopFiles) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const nameMatch = content.match(/^Name=(.+)$/m);
                const execMatch = content.match(/^Exec=(\S+)/m);
                if (nameMatch && execMatch && !seenNames.has(nameMatch[1])) {
                    const execPath = execMatch[1].replace(/%[uUfF]/g, '').trim();
                    found.push({
                        name: nameMatch[1],
                        command: execPath,
                    });
                    seenNames.add(nameMatch[1]);
                }
            } catch {
                // skip unreadable desktop files
            }
        }
    } catch {
        // fallback if grep fails
    }

    return found;
}

export async function getInstalledBrowsers(): Promise<BrowserInfo[]> {
    if (cachedBrowsers) {
        return cachedBrowsers;
    }

    try {
        switch (process.platform) {
        case 'darwin':
            cachedBrowsers = await getMacOSBrowsers();
            break;
        case 'win32':
            cachedBrowsers = await getWindowsBrowsers();
            break;
        case 'linux':
            cachedBrowsers = await getLinuxBrowsers();
            break;
        default:
            cachedBrowsers = [];
        }
    } catch (error) {
        log.error('Failed to detect installed browsers', {error});
        cachedBrowsers = [];
    }

    log.debug('Detected installed browsers', {browsers: cachedBrowsers.map((b) => b.name)});
    return cachedBrowsers;
}

export function clearBrowserCache(): void {
    cachedBrowsers = null;
}

export async function openLinkInBrowser(url: string, browser: BrowserInfo): Promise<void> {
    log.debug('Opening link in browser', {url, browser: browser.name});
    try {
        const escapedUrl = url.replace(/"/g, '\\"');
        if (process.platform === 'win32') {
            await exec(`${browser.command} "${escapedUrl}"`, {timeout: 10000});
        } else {
            await exec(`${browser.command} "${escapedUrl}"`, {timeout: 10000});
        }
    } catch (error) {
        log.error('Failed to open link in browser, falling back to default', {browser: browser.name, error});
        shell.openExternal(url);
    }
}

export class BrowserManager {
    init = async () => {
        await getInstalledBrowsers();
    };
}

const browserManager = new BrowserManager();
export default browserManager;
