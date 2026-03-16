// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {exec as execOriginal} from 'child_process';
import {promisify} from 'util';

import {shell} from 'electron';

import {Logger} from 'common/log';

const exec = promisify(execOriginal);
const log = new Logger('BrowserManager');

export interface BrowserInfo {
    name: string;
    path: string;
    bundleId: string;
}

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

let cachedBrowsers: BrowserInfo[] | null = null;

async function getAppPathForBundleId(bundleId: string): Promise<string | null> {
    try {
        const {stdout} = await exec(
            `mdfind "kMDItemCFBundleIdentifier == '${bundleId}'" | head -1`,
            {timeout: 5000},
        );
        const appPath = stdout.trim();
        return appPath.length > 0 ? appPath : null;
    } catch {
        return null;
    }
}

export async function getInstalledBrowsers(): Promise<BrowserInfo[]> {
    if (cachedBrowsers) {
        return cachedBrowsers;
    }

    if (process.platform !== 'darwin') {
        return [];
    }

    const results = await Promise.all(
        KNOWN_MACOS_BROWSERS.map(async (browser) => {
            const appPath = await getAppPathForBundleId(browser.bundleId);
            if (appPath) {
                return {
                    name: browser.name,
                    path: appPath,
                    bundleId: browser.bundleId,
                };
            }
            return null;
        }),
    );

    cachedBrowsers = results.filter((b): b is BrowserInfo => b !== null);
    log.debug('Detected installed browsers', {browsers: cachedBrowsers.map((b) => b.name)});
    return cachedBrowsers;
}

export function clearBrowserCache(): void {
    cachedBrowsers = null;
}

export async function openLinkInBrowser(url: string, browser: BrowserInfo): Promise<void> {
    log.debug('Opening link in browser', {url, browser: browser.name});
    try {
        await exec(`open -b "${browser.bundleId}" "${url}"`, {timeout: 10000});
    } catch (error) {
        log.error('Failed to open link in browser, falling back to default', {browser: browser.name, error});
        shell.openExternal(url);
    }
}

export class BrowserManager {
    init = async () => {
        if (process.platform === 'darwin') {
            await getInstalledBrowsers();
        }
    };
}

const browserManager = new BrowserManager();
export default browserManager;
