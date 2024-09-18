// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {exec as execOriginal} from 'child_process';
import fs from 'fs';
import path from 'path';
import {promisify} from 'util';
const exec = promisify(execOriginal);

import type {BrowserWindow} from 'electron';
import {app} from 'electron';

import {BACK_BAR_HEIGHT, customLoginRegexPaths, TAB_BAR_HEIGHT} from 'common/utils/constants';
import {isAdminUrl, isPluginUrl, isTeamUrl, isUrlType, parseURL} from 'common/utils/url';

import type {Args} from 'types/args';

export function isInsideRectangle(container: Electron.Rectangle, rect: Electron.Rectangle) {
    if (container.x > rect.x) {
        return false;
    }

    if (container.x + container.width < rect.x + rect.width) {
        return false;
    }

    if (container.y > rect.y) {
        return false;
    }

    if (container.y + container.height < rect.y + rect.height) {
        return false;
    }

    return true;
}

export function shouldBeHiddenOnStartup(parsedArgv: Args) {
    if (parsedArgv.hidden) {
        return true;
    }
    if (process.platform === 'darwin') {
        if (app.getLoginItemSettings().wasOpenedAsHidden) {
            return true;
        }
    }
    return false;
}

export function getWindowBoundaries(win: BrowserWindow, hasBackBar = false) {
    const {width, height} = win.getContentBounds();
    return getAdjustedWindowBoundaries(width, height, hasBackBar);
}

export function getAdjustedWindowBoundaries(width: number, height: number, hasBackBar = false) {
    return {
        x: 0,
        y: TAB_BAR_HEIGHT + (hasBackBar ? BACK_BAR_HEIGHT : 0),
        width,
        height: height - TAB_BAR_HEIGHT - (hasBackBar ? BACK_BAR_HEIGHT : 0),
    };
}

export function shouldHaveBackBar(serverUrl: URL, inputURL: URL) {
    if (isUrlType('login', serverUrl, inputURL)) {
        const serverURL = parseURL(serverUrl);
        const subpath = serverURL ? serverURL.pathname : '';
        const parsedURL = parseURL(inputURL);
        if (!parsedURL) {
            return false;
        }
        const urlPath = parsedURL.pathname;
        const replacement = subpath.endsWith('/') ? '/' : '';
        const replacedPath = urlPath.replace(subpath, replacement);
        for (const regexPath of customLoginRegexPaths) {
            if (replacedPath.match(regexPath)) {
                return true;
            }
        }

        return false;
    }
    return !isTeamUrl(serverUrl, inputURL) && !isAdminUrl(serverUrl, inputURL) && !isPluginUrl(serverUrl, inputURL);
}

export function getLocalPreload(file: string) {
    return path.join(app.getAppPath(), file);
}

export function composeUserAgent(browserMode?: boolean) {
    const baseUserAgent = app.userAgentFallback.split(' ');

    // filter out the Mattermost tag that gets added earlier on
    const filteredUserAgent = baseUserAgent.filter((ua) => !ua.startsWith('Mattermost'));

    if (browserMode) {
        return filteredUserAgent.join(' ');
    }

    return `${filteredUserAgent.join(' ')} Mattermost/${app.getVersion()}`;
}

export function isStringWithLength(string: unknown): boolean {
    return typeof string === 'string' && string.length > 0;
}

export function getPercentage(received: number, total: number) {
    if (total === 0) {
        return 0;
    }
    return Math.round((received / total) * 100);
}

export function readFilenameFromContentDispositionHeader(header: string[]) {
    return header?.join(';')?.match(/(?<=filename=")(.*)(?=")/g)?.[0];
}

export function doubleSecToMs(d: number): number {
    return Math.round(d * 1000);
}

export function shouldIncrementFilename(filepath: string, increment = 0): string {
    const {dir, name, ext} = path.parse(filepath);
    const incrementString = increment ? ` (${increment})` : '';
    const filename = `${name}${incrementString}${ext}`;

    let fileExists = true;
    try {
        fs.accessSync(path.join(dir, filename), fs.constants.F_OK);
    } catch (error) {
        fileExists = false;
    }

    if (fileExists) {
        return shouldIncrementFilename(filepath, increment + 1);
    }
    return filename;
}

export function resetScreensharePermissionsMacOS() {
    if (process.platform !== 'darwin') {
        return Promise.resolve();
    }
    return exec('tccutil reset ScreenCapture Mattermost.Desktop',
        {timeout: 1000});
}

export function openScreensharePermissionsSettingsMacOS() {
    if (process.platform !== 'darwin') {
        return Promise.resolve();
    }
    return exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"',
        {timeout: 1000});
}
