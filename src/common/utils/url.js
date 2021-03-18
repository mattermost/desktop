// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isHttpsUri, isHttpUri, isUri} from 'valid-url';

import buildConfig from '../config/buildConfig';

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

function getDomain(inputURL) {
    const parsedURL = parseURL(inputURL);
    return parsedURL.origin;
}

function isValidURL(testURL) {
    return Boolean(isHttpUri(testURL) || isHttpsUri(testURL)) && parseURL(testURL) !== null;
}

function isValidURI(testURL) {
    return Boolean(isUri(testURL));
}

function parseURL(inputURL) {
    if (!inputURL) {
        return null;
    }
    if (inputURL instanceof URL) {
        return inputURL;
    }
    try {
        return new URL(inputURL);
    } catch (e) {
        return null;
    }
}

function getHost(inputURL) {
    const parsedURL = parseURL(inputURL);
    if (parsedURL) {
        return parsedURL.origin;
    }
    throw new Error(`Couldn't parse url: ${inputURL}`);
}

// isInternalURL determines if the target url is internal to the application.
// - currentURL is the current url inside the webview
// - basename is the global export from the Mattermost application defining the subpath, if any
function isInternalURL(targetURL, currentURL, basename = '/') {
    if (targetURL.host !== currentURL.host) {
        return false;
    }

    if (!(targetURL.pathname || '/').startsWith(basename)) {
        return false;
    }

    return true;
}

function getServerInfo(serverUrl) {
    const parsedServer = parseURL(serverUrl);
    if (!parsedServer) {
        return null;
    }

    // does the server have a subpath?
    const pn = parsedServer.pathname.toLowerCase();
    const subpath = pn.endsWith('/') ? pn.toLowerCase() : `${pn}/`;
    return {origin: parsedServer.origin, subpath, url: parsedServer};
}

function getManagedResources() {
    if (!buildConfig) {
        return [];
    }

    return buildConfig.managedResources || [];
}

function isAdminUrl(serverUrl, inputUrl) {
    const parsedURL = parseURL(inputUrl);
    const server = getServerInfo(serverUrl);
    if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server, parsedURL))) {
        return null;
    }
    return (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}/admin_console/`) ||
    parsedURL.pathname.toLowerCase().startsWith('/admin_console/'));
}

function isTeamUrl(serverUrl, inputUrl, withApi) {
    const parsedURL = parseURL(inputUrl);
    const server = getServerInfo(serverUrl);
    if (!parsedURL || !server || (!equalUrlsIgnoringSubpath(server, parsedURL))) {
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

function isPluginUrl(serverUrl, inputURL) {
    const server = getServerInfo(serverUrl);
    const parsedURL = parseURL(inputURL);
    if (!parsedURL || !server) {
        return false;
    }
    return (
        equalUrlsIgnoringSubpath(server, parsedURL) &&
    (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}plugins/`) ||
      parsedURL.pathname.toLowerCase().startsWith('/plugins/')));
}

function isManagedResource(serverUrl, inputURL) {
    const server = getServerInfo(serverUrl);
    const parsedURL = parseURL(inputURL);
    if (!parsedURL || !server) {
        return false;
    }

    const managedResources = getManagedResources();

    return (
        equalUrlsIgnoringSubpath(server, parsedURL) && managedResources && managedResources.length &&
    managedResources.some((managedResource) => (parsedURL.pathname.toLowerCase().startsWith(`${server.subpath}${managedResource}/`) || parsedURL.pathname.toLowerCase().startsWith(`/${managedResource}/`))));
}

function getServer(inputURL, teams, ignoreScheme = false) {
    const parsedURL = parseURL(inputURL);
    if (!parsedURL) {
        return null;
    }
    let parsedServerUrl;
    let secondOption = null;
    for (let i = 0; i < teams.length; i++) {
        parsedServerUrl = parseURL(teams[i].url);

        // check server and subpath matches (without subpath pathname is \ so it always matches)
        if (equalUrlsWithSubpath(parsedServerUrl, parsedURL, ignoreScheme)) {
            return {name: teams[i].name, url: parsedServerUrl, index: i};
        }
        if (equalUrlsIgnoringSubpath(parsedServerUrl, parsedURL, ignoreScheme)) {
            // in case the user added something on the path that doesn't really belong to the server
            // there might be more than one that matches, but we can't differentiate, so last one
            // is as good as any other in case there is no better match (e.g.: two subpath servers with the same origin)
            // e.g.: https://community.mattermost.com/core
            secondOption = {name: teams[i].name, url: parsedServerUrl, index: i};
        }
    }
    return secondOption;
}

// next two functions are defined to clarify intent
function equalUrlsWithSubpath(url1, url2, ignoreScheme) {
    if (ignoreScheme) {
        return url1.host === url2.host && url2.pathname.toLowerCase().startsWith(url1.pathname.toLowerCase());
    }
    return url1.origin === url2.origin && url2.pathname.toLowerCase().startsWith(url1.pathname.toLowerCase());
}

function equalUrlsIgnoringSubpath(url1, url2, ignoreScheme) {
    if (ignoreScheme) {
        return url1.host.toLowerCase() === url2.host.toLowerCase();
    }
    return url1.origin.toLowerCase() === url2.origin.toLowerCase();
}

function isTrustedURL(url, teams) {
    const parsedURL = parseURL(url);
    if (!parsedURL) {
        return false;
    }
    return getServer(parsedURL, teams) !== null;
}

function isCustomLoginURL(url, server, teams) {
    const subpath = (server === null || typeof server === 'undefined') ? '' : server.url.pathname;
    const parsedURL = parseURL(url);
    if (!parsedURL) {
        return false;
    }
    if (!isTrustedURL(parsedURL, teams)) {
        return false;
    }
    const urlPath = parsedURL.pathname;
    if ((subpath !== '' || subpath !== '/') && urlPath.startsWith(subpath)) {
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

export default {
    getDomain,
    isValidURL,
    isValidURI,
    isInternalURL,
    parseURL,
    getServer,
    getServerInfo,
    isAdminUrl,
    isTeamUrl,
    isPluginUrl,
    isManagedResource,
    getHost,
    isTrustedURL,
    isCustomLoginURL,
};
