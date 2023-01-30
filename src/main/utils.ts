// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';
import fs from 'fs';

import {app, BrowserWindow} from 'electron';

import {Args} from 'types/args';

import {BACK_BAR_HEIGHT, customLoginRegexPaths, PRODUCTION, TAB_BAR_HEIGHT, DEFAULT_CSP_HEADER, INTERNAL_PROTOCOL} from 'common/utils/constants';
import UrlUtils from 'common/utils/url';
import Utils from 'common/utils/util';

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

export function shouldHaveBackBar(serverUrl: URL, inputURL: URL | string) {
    const mmDesktopUrl = convertURLToMMDesktop(serverUrl);
    if (UrlUtils.isUrlType('login', serverUrl, inputURL)) {
        const subpath = mmDesktopUrl ? mmDesktopUrl.pathname : '';
        const parsedURL = UrlUtils.parseURL(inputURL);
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
    return !UrlUtils.isTeamUrl(mmDesktopUrl, inputURL) && !UrlUtils.isAdminUrl(mmDesktopUrl, inputURL) && !UrlUtils.isPluginUrl(mmDesktopUrl, inputURL);
}

export function getLocalFileString(urlPath: string, isMain?: boolean) {
    let pathname;
    const processPath = isMain ? '' : '/renderer';
    const mode = Utils.runMode();
    if (mode === PRODUCTION) {
        pathname = path.join(app.getAppPath(), `${processPath}/${urlPath}`);
    } else {
        pathname = path.resolve(__dirname, `../../dist/${processPath}/${urlPath}`); // TODO: find a better way to work with webpack on this
    }
    return pathname;
}

export function getLocalURLString(urlPath: string, query?: Map<string, string>, isMain?: boolean) {
    const pathname = getLocalFileString(urlPath, isMain);
    const protocol = 'file';
    const hostname = '';
    const port = '';
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

function createBaselineCSPHeader(origin: string) {
    return DEFAULT_CSP_HEADER.replaceAll('{server-origin}', origin);
}

export function makeCSPHeader(serverURL: URL, remoteCSPHeader?: string) {
    if (!remoteCSPHeader) {
        return createBaselineCSPHeader(serverURL.origin);
    }

    let headerMap = addToCSPMap(new Map(), createBaselineCSPHeader(serverURL.origin));
    headerMap = addToCSPMap(headerMap, remoteCSPHeader, (piece) => {
        if (piece === "'self'") {
            return serverURL.origin;
        }
        return piece;
    });

    const subheaders = [...headerMap.keys()];
    const header = subheaders.map((sub) => `${sub} ${headerMap.get(sub)?.join(' ')}`).join('; ');
    return header;
}

function addToCSPMap(cspMap: Map<string, string[]>, header: string, ...filters: Array<(x: string) => string>) {
    header.split('; ').forEach((section) => {
        const pieces = section.split(' ');
        let existingPieces = (cspMap.get(pieces[0]) ?? []);

        let newPieces = pieces.slice(1);
        filters.forEach((func) => {
            newPieces = newPieces.map(func) as string[];
        });

        existingPieces = existingPieces.concat(newPieces);
        existingPieces = existingPieces.filter((value, index, self) => index === self.findIndex((t) => (t === value)));
        cspMap.set(pieces[0], existingPieces);
    });
    return cspMap;
}

function parseCookieString(cookie: string) {
    const output: any = {};
    cookie.split(/\s*;\s*/).forEach((value) => {
        const kvp = value.split(/\s*=\s*/);
        output[kvp[0]] = kvp.splice(1).join('=');
    });
    return output;
}

export function createCookieSetDetailsFromCookieString(cookie: string, url: string, domain: string) {
    const parsedCookie = cookie.split(';')[0];
    const [cookieName, cookieValue] = parsedCookie.split('=');
    const cookieObject = parseCookieString(cookie);
    return {
        url,
        name: cookieName.trim(),
        value: cookieValue.trim(),
        domain,
        path: cookieObject.Path,
        secure: Object.hasOwn(cookieObject, 'Secure'),
        httpOnly: Object.hasOwn(cookieObject, 'HttpOnly'),
        expirationDate: new Date(cookieObject.Expires).valueOf(),
    };
}

export function convertURLToMMDesktop(url: URL) {
    return new URL(`${url}`.replace(/^http(s)?:/, `${INTERNAL_PROTOCOL}:`));
}
