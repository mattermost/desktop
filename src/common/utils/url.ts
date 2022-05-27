// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isHttpsUri, isHttpUri, isUri} from 'valid-url';

import {TeamWithTabs} from 'types/config';
import {ServerFromURL} from 'types/utils';

import buildConfig from 'common/config/buildConfig';
import {MattermostServer} from 'common/servers/MattermostServer';
import {getServerView} from 'common/tabs/TabView';
import {customLoginRegexPaths, nonTeamUrlPaths} from 'common/utils/constants';

function isValidURL(testURL: string) {
    return Boolean(isHttpUri(testURL) || isHttpsUri(testURL)) && Boolean(parseURL(testURL));
}

function isValidURI(testURL: string) {
    return Boolean(isUri(testURL));
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

function getView(inputURL: URL | string, teams: TeamWithTabs[], ignoreScheme = false): ServerFromURL | undefined {
    const parsedURL = parseURL(inputURL);
    if (!parsedURL) {
        return undefined;
    }
    let firstOption;
    let secondOption;
    teams.forEach((team) => {
        const srv = new MattermostServer(team.name, team.url);

        // sort by length so that we match the highest specificity last
        const filteredTabs = team.tabs.map((tab) => {
            const tabView = getServerView(srv, tab);
            const parsedServerUrl = parseURL(tabView.url);
            return {tabView, parsedServerUrl};
        });

        filteredTabs.sort((a, b) => a.tabView.url.toString().length - b.tabView.url.toString().length);
        filteredTabs.forEach((tab) => {
            if (tab.parsedServerUrl) {
                // check server and subpath matches (without subpath pathname is \ so it always matches)
                if (getFormattedPathName(tab.parsedServerUrl.pathname) !== '/' && equalUrlsWithSubpath(tab.parsedServerUrl, parsedURL, ignoreScheme)) {
                    firstOption = {name: tab.tabView.name, url: tab.parsedServerUrl.toString()};
                }
                if (getFormattedPathName(tab.parsedServerUrl.pathname) === '/' && equalUrlsIgnoringSubpath(tab.parsedServerUrl, parsedURL, ignoreScheme)) {
                    // in case the user added something on the path that doesn't really belong to the server
                    // there might be more than one that matches, but we can't differentiate, so last one
                    // is as good as any other in case there is no better match (e.g.: two subpath servers with the same origin)
                    // e.g.: https://community.mattermost.com/core
                    secondOption = {name: tab.tabView.name, url: tab.parsedServerUrl.toString()};
                }
            }
        });
    });
    return firstOption || secondOption;
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

function isTrustedURL(url: URL | string, teams: TeamWithTabs[]) {
    const parsedURL = parseURL(url);
    if (!parsedURL) {
        return false;
    }
    return getView(parsedURL, teams) !== null;
}

function isCustomLoginURL(url: URL | string, server: ServerFromURL, teams: TeamWithTabs[]): boolean {
    const serverURL = parseURL(server.url);
    const subpath = server && serverURL ? serverURL.pathname : '';
    const parsedURL = parseURL(url);
    if (!parsedURL) {
        return false;
    }
    if (!isTrustedURL(parsedURL, teams)) {
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

export default {
    isValidURL,
    isValidURI,
    isInternalURL,
    parseURL,
    getView,
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
};
