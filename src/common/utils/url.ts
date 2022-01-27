// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isHttpsUri, isHttpUri, isUri} from 'valid-url';

import {TeamWithTabs} from 'types/config';
import {ServerFromURL} from 'types/utils';

import buildConfig from '../config/buildConfig';
import {MattermostServer} from '../servers/MattermostServer';
import {getServerView} from '../tabs/TabView';

// supported custom login paths (oath, saml)
const customLoginRegexPaths = [
    /^\/oauth\/authorize$/i,
    /^\/oauth\/deauthorize$/i,
    /^\/oauth\/access_token$/i,
    /^\/oauth\/[A-Za-z0-9]+\/complete$/i,
    /^\/oauth\/[A-Za-z0-9]+\/login$/i,
    /^\/oauth\/[A-Za-z0-9]+\/signup$/i,
    /^\/api\/v3\/oauth\/[A-Za-z0-9]+\/complete$/i,
    /^\/signup\/[A-Za-z0-9]+\/complete$/i,
    /^\/login\/[A-Za-z0-9]+\/complete$/i,
    /^\/login\/sso\/saml$/i,
];

function getDomain(inputURL: URL | string) {
    const parsedURL = parseURL(inputURL);
    return parsedURL?.origin;
}

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
    throw new Error(`Couldn't parse url: ${inputURL}`);
}

// isInternalURL determines if the target url is internal to the application.
// - currentURL is the current url inside the webview
// - basename is the global export from the Mattermost application defining the subpath, if any
function isInternalURL(targetURL: URL, currentURL: URL, basename = '/') {
    if (targetURL.host !== currentURL.host) {
        return false;
    }

    if (!(targetURL.pathname || '/').startsWith(basename)) {
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
    return pn.endsWith('/') ? pn.toLowerCase() : `${pn}/`;
}

function getManagedResources() {
    if (!buildConfig) {
        return [];
    }

    return buildConfig.managedResources || [];
}

function isAdminUrl(serverUrl: URL | string, inputUrl: URL | string) {
    const parsedURL = parseURL(inputUrl);
    const server = getServerInfo(serverUrl);
    if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server.url, parsedURL))) {
        return null;
    }
    return (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}/admin_console/`) ||
    parsedURL.pathname.toLowerCase().startsWith('/admin_console/'));
}

function isTeamUrl(serverUrl: URL | string, inputUrl: URL | string, withApi?: boolean) {
    if (!serverUrl || !inputUrl) {
        return false;
    }
    const parsedURL = parseURL(inputUrl);
    const server = getServerInfo(serverUrl);
    if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server.url, parsedURL))) {
        return null;
    }

    // pre process nonTeamUrlPaths
    let nonTeamUrlPaths = [
        'plugins',
        'signup',
        'login',
        'admin',
        'channel',
        'post',
        'oauth',
        'admin_console',
    ];
    const managedResources = getManagedResources();
    nonTeamUrlPaths = nonTeamUrlPaths.concat(managedResources);

    if (withApi) {
        nonTeamUrlPaths.push('api');
    }
    return !(nonTeamUrlPaths.some((testPath) => (
        parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}${testPath}/`) ||
    parsedURL.pathname.toLowerCase().startsWith(`/${testPath}/`))));
}

function isPluginUrl(serverUrl: URL | string, inputURL: URL | string) {
    const server = getServerInfo(serverUrl);
    const parsedURL = parseURL(inputURL);
    if (!parsedURL || !server) {
        return false;
    }
    return (
        equalUrlsIgnoringSubpath(server.url, parsedURL) &&
    (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}plugins/`) ||
      parsedURL.pathname.toLowerCase().startsWith('/plugins/')));
}

function isManagedResource(serverUrl: URL | string, inputURL: URL | string) {
    const server = getServerInfo(serverUrl);
    const parsedURL = parseURL(inputURL);
    if (!parsedURL || !server) {
        return false;
    }

    const managedResources = getManagedResources();

    return (
        equalUrlsIgnoringSubpath(server.url, parsedURL) && managedResources && managedResources.length &&
    managedResources.some((managedResource) => (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}${managedResource}/`) || parsedURL.pathname.toLowerCase().startsWith(`/${managedResource}/`))));
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
        team.tabs.forEach((tab) => {
            const tabView = getServerView(srv, tab);
            const parsedServerUrl = parseURL(tabView.url);
            if (parsedServerUrl) {
                // check server and subpath matches (without subpath pathname is \ so it always matches)
                if (equalUrlsWithSubpath(parsedServerUrl, parsedURL, ignoreScheme)) {
                    firstOption = {name: tabView.name, url: parsedServerUrl.toString()};
                }
                if (equalUrlsIgnoringSubpath(parsedServerUrl, parsedURL, ignoreScheme)) {
                    // in case the user added something on the path that doesn't really belong to the server
                    // there might be more than one that matches, but we can't differentiate, so last one
                    // is as good as any other in case there is no better match (e.g.: two subpath servers with the same origin)
                    // e.g.: https://community.mattermost.com/core
                    secondOption = {name: tabView.name, url: parsedServerUrl.toString()};
                }
            }
        });
    });
    return firstOption || secondOption;
}

// next two functions are defined to clarify intent
function equalUrlsWithSubpath(url1: URL, url2: URL, ignoreScheme?: boolean) {
    if (ignoreScheme) {
        return url1.host === url2.host && url2.pathname.toLowerCase().startsWith(url1.pathname.toLowerCase());
    }
    return url1.origin === url2.origin && url2.pathname.toLowerCase().startsWith(url1.pathname.toLowerCase());
}

function equalUrlsIgnoringSubpath(url1: URL, url2: URL, ignoreScheme?: boolean) {
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
    if (subpath !== '' && subpath !== '/' && urlPath.startsWith(subpath)) {
        const replacement = subpath.endsWith('/') ? '/' : '';
        const replacedPath = urlPath.replace(subpath, replacement);
        for (const regexPath of customLoginRegexPaths) {
            if (replacedPath.match(regexPath)) {
                return true;
            }
        }
    }

    // if there is no subpath, or we are adding the team and got redirected to the real server it'll be caught here
    for (const regexPath of customLoginRegexPaths) {
        if (urlPath.match(regexPath)) {
            return true;
        }
    }
    return false;
}

function isChannelExportUrl(serverUrl: URL | string, inputUrl: URL | string): boolean {
    const server = getServerInfo(serverUrl);
    const parsedURL = parseURL(inputUrl);
    if (!parsedURL || !server) {
        return false;
    }
    return (
        equalUrlsIgnoringSubpath(server.url, parsedURL) &&
    (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}plugins/com.mattermost.plugin-channel-export/api/v1/export`) ||
      parsedURL.pathname.toLowerCase().startsWith('/plugins/com.mattermost.plugin-channel-export/api/v1/export')));
}

export default {
    getDomain,
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
};
