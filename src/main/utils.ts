// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import fs from 'fs';

import {exec as execOriginal} from 'child_process';

import {promisify} from 'util';
const exec = promisify(execOriginal);

import {app, BrowserWindow} from 'electron';

import {Args} from 'types/args';

import {BACK_BAR_HEIGHT, customLoginRegexPaths, PRODUCTION, TAB_BAR_HEIGHT} from 'common/utils/constants';
import Utils from 'common/utils/util';
import {isAdminUrl, isPluginUrl, isTeamUrl, isUrlType, parseURL} from 'common/utils/url';

export function isInsideRectangle(container: Electron.Rectangle, rect: Electron.Rectangle) {
    return container.x <= rect.x && container.y <= rect.y && container.width >= rect.width && container.height >= rect.height;
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

export function getLocalURLString(urlPath: string, query?: Map<string, string>, isMain?: boolean) {
    let pathname;
    const processPath = isMain ? '' : '/renderer';
    const mode = Utils.runMode();
    const protocol = 'file';
    const hostname = '';
    const port = '';
    if (mode === PRODUCTION) {
        pathname = path.join(app.getAppPath(), `${processPath}/${urlPath}`);
    } else {
        pathname = path.resolve(__dirname, `../../dist/${processPath}/${urlPath}`); // TODO: find a better way to work with webpack on this
    }
    const localUrl = new URL(`${protocol}://${hostname}${port}`);
    localUrl.pathname = pathname;
    if (query) {
        query.forEach((value: string, key: string) => {
            localUrl.searchParams.append(encodeURIComponent(key), encodeURIComponent(value));
        });
    }

    return localUrl.href;
}

export function getLocalPreload(file: string) {
    if (Utils.runMode() === PRODUCTION) {
        return path.join(app.getAppPath(), `${file}`);
    }
    return path.resolve(__dirname, `../../dist/${file}`);
}

export function composeUserAgent() {
    const baseUserAgent = app.userAgentFallback.split(' ');

    // filter out the Mattermost tag that gets added earlier on
    const filteredUserAgent = baseUserAgent.filter((ua) => !ua.startsWith('Mattermost'));

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
