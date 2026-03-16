// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {exec as execOriginal, execFile as execFileOriginal} from 'child_process';
import fs from 'fs';
import path from 'path';
import {promisify} from 'util';

import {shell} from 'electron';

import {Logger} from 'common/log';

const exec = promisify(execOriginal);
const execFile = promisify(execFileOriginal);
const log = new Logger('BrowserManager');

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

const WINDOWS_REGISTRY_ROOTS = [
    'HKLM\\SOFTWARE\\Clients\\StartMenuInternet',
    'HKCU\\SOFTWARE\\Clients\\StartMenuInternet',
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

const LINUX_DESKTOP_DIRS = [
    '/usr/share/applications',
    path.join(process.env.HOME || '', '.local/share/applications'),
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
    return results.filter((b): b is BrowserInfo => b !== null);
}

/**
 * Parse a Windows registry command string (e.g. from shell\open\command).
 * The value may be a quoted path with flags and a %1 placeholder, e.g.:
 *   "C:\Program Files\Browser\browser.exe" --flag %1
 *   C:\Browser\browser.exe
 */
function parseRegistryCommand(raw: string): {executable: string; args: string[]} | null {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }

    let executable: string;
    let rest: string;

    if (trimmed.startsWith('"')) {
        const closingQuote = trimmed.indexOf('"', 1);
        if (closingQuote === -1) {
            return null;
        }
        executable = trimmed.substring(1, closingQuote);
        rest = trimmed.substring(closingQuote + 1).trim();
    } else {
        const spaceIndex = trimmed.indexOf(' ');
        if (spaceIndex === -1) {
            executable = trimmed;
            rest = '';
        } else {
            executable = trimmed.substring(0, spaceIndex);
            rest = trimmed.substring(spaceIndex + 1).trim();
        }
    }

    // Filter out placeholders like %1, %*, etc. and keep real arguments
    const args = rest.split(/\s+/).filter((token) => token && !(/(%\d|%\*)/).test(token));

    return {executable, args};
}

// Windows detection via registry (checks both HKLM and HKCU)
async function getWindowsBrowsers(): Promise<BrowserInfo[]> {
    const seenNames = new Set<string>();
    const found: BrowserInfo[] = [];

    const results = await Promise.all(
        WINDOWS_REGISTRY_ROOTS.flatMap((root) =>
            KNOWN_WINDOWS_BROWSERS.map(async (browser) => {
                try {
                    const {stdout} = await exec(
                        `reg query "${root}\\${browser.registryKey}\\shell\\open\\command" /ve`,
                        {timeout: 5000},
                    );

                    const match = stdout.match(/REG_SZ\s+(.+)/);
                    if (match) {
                        const parsed = parseRegistryCommand(match[1].trim());
                        if (parsed && fs.existsSync(parsed.executable)) {
                            return {
                                name: browser.name,
                                executable: parsed.executable,
                                args: parsed.args,
                            };
                        }
                    }
                } catch {
                    // browser not found in registry
                }
                return null;
            }),
        ),
    );

    for (const result of results) {
        if (result && !seenNames.has(result.name)) {
            found.push(result);
            seenNames.add(result.name);
        }
    }

    return found;
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
                        return {name: browser.name, executable: stdout.trim(), args: [] as string[]};
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
    const existingDirs = LINUX_DESKTOP_DIRS.filter((dir) => fs.existsSync(dir));
    const desktopDirResults = await Promise.all(
        existingDirs.map(async (dir) => {
            try {
                const {stdout} = await exec(
                    `grep -rl "x-scheme-handler/https" "${dir}" 2>/dev/null || true`,
                    {timeout: 5000},
                );
                return stdout.trim().split('\n').filter(Boolean);
            } catch {
                return [];
            }
        }),
    );

    for (const file of desktopDirResults.flat()) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const nameMatch = content.match(/^Name=(.+)$/m);
            const execMatch = content.match(/^Exec=(\S+)/m);
            if (nameMatch && execMatch && !seenNames.has(nameMatch[1])) {
                const execPath = execMatch[1].replace(/%[uUfF]/g, '').trim();

                // Only accept absolute paths that point to an existing executable
                if (path.isAbsolute(execPath) && fs.existsSync(execPath)) {
                    found.push({
                        name: nameMatch[1],
                        executable: execPath,
                        args: [],
                    });
                    seenNames.add(nameMatch[1]);
                }
            }
        } catch {
            // skip unreadable desktop files
        }
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
    log.debug('Opening link in browser', {browser: browser.name});
    try {
        // Use execFile to avoid shell interpretation — URL is passed as an argument, not interpolated
        await execFile(browser.executable, [...browser.args, url], {timeout: 10000});
    } catch (execError) {
        log.error('execFile failed to open link, falling back to default browser', {browser: browser.name, error: execError});
        try {
            await shell.openExternal(url);
        } catch (fallbackError) {
            log.error('Fallback shell.openExternal also failed', {error: fallbackError});
        }
    }
}

export class BrowserManager {
    init = async () => {
        await getInstalledBrowsers();
    };
}

const browserManager = new BrowserManager();
export default browserManager;
