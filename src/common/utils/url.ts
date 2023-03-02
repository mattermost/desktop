// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isHttpsUri, isHttpUri, isUri} from 'valid-url';

import buildConfig from 'common/config/buildConfig';
import {customLoginRegexPaths, nonTeamUrlPaths, CALLS_PLUGIN_ID} from 'common/utils/constants';

function isValidURL(testURL: string) {
    return Boolean(isHttpUri(testURL) || isHttpsUri(testURL)) && Boolean(parseURL(testURL));
}

function isValidURI(testURL: string) {
    return Boolean(isUri(testURL));
}

function startsWithProtocol(testURL: string) {
    return Boolean((/^https?:\/\/.*/).test(testURL.trim()));
}

function parseURL(inputURL: URL | string) {
    if (inputURL instanceof URL) {
        return inputURL;
    }
    try {
        return new URL(inputURL.replace(/([^:]\/)\/+/g, '$1'));
    } catch (e) {
        return undefined;
    }
}

function getHost(inputURL: URL | string) {
    const parsedURL = parseURL(inputURL);
    if (parsedURL) {
        return parsedURL.origin;
    }
    throw new SyntaxError(`Couldn't parse url: ${inputURL}`);
}

// isInternalURL determines if the target url is internal to the application.
// - currentURL is the current url inside the webview
function isInternalURL(targetURL: URL | undefined, currentURL: URL) {
    if (!targetURL) {
        return false;
    }

    if (targetURL.host !== currentURL.host) {
        return false;
    }

    if (!equalUrlsWithSubpath(targetURL, currentURL) && !(targetURL.pathname || '/').startsWith(currentURL.pathname)) {
        return false;
    }

    return true;
}

function getServerInfo(serverUrl: URL | string) {
    const parsedServer = parseURL(serverUrl);
    if (!parsedServer) {
        return undefined;
    }

    // does the server have a subpath?
    const pn = parsedServer.pathname.toLowerCase();
    const subpath = getFormattedPathName(pn);
    return {subpath, url: parsedServer};
}

export function getFormattedPathName(pn: string) {
    return pn.endsWith('/') ? pn.toLowerCase() : `${pn.toLowerCase()}/`;
}

function getManagedResources() {
    if (!buildConfig) {
        return [];
    }

    return buildConfig.managedResources || [];
}

export function isUrlType(urlType: string, serverUrl: URL | string, inputURL: URL | string) {
    if (!serverUrl || !inputURL) {
        return false;
    }

    const parsedURL = parseURL(inputURL);
    const server = getServerInfo(serverUrl);
    if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server.url, parsedURL))) {
        return false;
    }
    return (getFormattedPathName(parsedURL.pathname).startsWith(`${server.subpath}${urlType}/`) ||
    getFormattedPathName(parsedURL.pathname).startsWith(`/${urlType}/`));
}

function isAdminUrl(serverUrl: URL | string, inputURL: URL | string) {
    return isUrlType('admin_console', serverUrl, inputURL);
}

function isTeamUrl(serverUrl: URL | string, inputURL: URL | string, withApi?: boolean) {
    const parsedURL = parseURL(inputURL);
    const server = getServerInfo(serverUrl);
    if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server.url, parsedURL))) {
        return false;
    }

    const paths = [...getManagedResources(), ...nonTeamUrlPaths];

    if (withApi) {
        paths.push('api');
    }
    return !(paths.some((testPath) => isUrlType(testPath, serverUrl, inputURL)));
}

function isPluginUrl(serverUrl: URL | string, inputURL: URL | string) {
    return isUrlType('plugins', serverUrl, inputURL);
}

function isManagedResource(serverUrl: URL | string, inputURL: URL | string) {
    const paths = [...getManagedResources()];
    return paths.some((testPath) => isUrlType(testPath, serverUrl, inputURL));
}

// next two functions are defined to clarify intent
export function equalUrlsWithSubpath(url1: URL, url2: URL, ignoreScheme?: boolean) {
    if (ignoreScheme) {
        return url1.host === url2.host && getFormattedPathName(url2.pathname).startsWith(getFormattedPathName(url1.pathname));
    }
    return url1.origin === url2.origin && getFormattedPathName(url2.pathname).startsWith(getFormattedPathName(url1.pathname));
}

export function equalUrlsIgnoringSubpath(url1: URL, url2: URL, ignoreScheme?: boolean) {
    if (ignoreScheme) {
        return url1.host.toLowerCase() === url2.host.toLowerCase();
    }
    return url1.origin.toLowerCase() === url2.origin.toLowerCase();
}

function isTrustedURL(url: URL | string, rootURL: URL | string) {
    const parsedURL = parseURL(url);
    const rootParsedURL = parseURL(rootURL);
    if (!parsedURL || !rootParsedURL) {
        return false;
    }
    return (getFormattedPathName(rootParsedURL.pathname) !== '/' && equalUrlsWithSubpath(rootParsedURL, parsedURL)) ||
        (getFormattedPathName(rootParsedURL.pathname) === '/' && equalUrlsIgnoringSubpath(rootParsedURL, parsedURL));
}

function isCustomLoginURL(url: URL | string, serverURL: URL | string): boolean {
    const parsedServerURL = parseURL(serverURL);
    const parsedURL = parseURL(url);
    if (!parsedURL || !parsedServerURL) {
        return false;
    }
    if (!isTrustedURL(parsedURL, parsedServerURL)) {
        return false;
    }
    const subpath = parsedServerURL.pathname;
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

function isChannelExportUrl(serverUrl: URL | string, inputUrl: URL | string): boolean {
    return isUrlType('plugins/com.mattermost.plugin-channel-export/api/v1/export', serverUrl, inputUrl);
}

function cleanPathName(basePathName: string, pathName: string) {
    if (basePathName === '/') {
        return pathName;
    }

    if (pathName.startsWith(basePathName)) {
        return pathName.replace(basePathName, '');
    }

    return pathName;
}

function isCallsPopOutURL(serverURL: URL | string, inputURL: URL | string, callID: string) {
    if (!serverURL || !inputURL || !callID) {
        return false;
    }

    const parsedURL = parseURL(inputURL);
    const server = getServerInfo(serverURL);
    if (!server || !parsedURL) {
        return false;
    }

    const matches = parsedURL.pathname.match(new RegExp(`^${server.subpath}([A-Za-z0-9-_]+)/`, 'i'));
    if (matches?.length !== 2) {
        return false;
    }

    const teamName = matches[1];
    const subPath = `${teamName}/${CALLS_PLUGIN_ID}/expanded/${callID}`;

    return isUrlType(subPath, serverURL, inputURL);
}

export default {
    isValidURL,
    isValidURI,
    isInternalURL,
    parseURL,
    getServerInfo,
    isAdminUrl,
    isTeamUrl,
    isPluginUrl,
    isManagedResource,
    getHost,
    isTrustedURL,
    isCustomLoginURL,
    isChannelExportUrl,
    isUrlType,
    cleanPathName,
    startsWithProtocol,
    isCallsPopOutURL,
};
