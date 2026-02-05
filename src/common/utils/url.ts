// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isHttpsUri, isHttpUri, isUri} from 'valid-url';

import buildConfig from 'common/config/buildConfig';
import {nonTeamUrlPaths, CALLS_PLUGIN_ID} from 'common/utils/constants';

export const getFormattedPathName = (pn: string) => (pn.endsWith('/') ? pn : `${pn}/`);
export const parseURL = (inputURL: string | URL) => {
    if (inputURL instanceof URL) {
        return inputURL;
    }
    try {
        return new URL(inputURL.replace(/([^:]\/)\/+/g, '$1')); // Regex here to remove extra slashes
    } catch (e) {
        return undefined;
    }
};

/**
 * URL form checks
 */

export const isValidURL = (testURL: string) => Boolean(isHttpUri(testURL) || isHttpsUri(testURL)) && Boolean(parseURL(testURL));
export const isValidURI = (testURL: string) => Boolean(isUri(testURL));

export function isHttpLink(link: string | undefined): link is string {
    if (!link) {
        return false;
    }

    const url = parseURL(link);

    if (!url) {
        return false;
    }

    return url.protocol === 'http:' || url.protocol === 'https:';
}

// isInternalURL determines if the target url is internal to the application.
// - currentURL is the current url inside the webview
export const isInternalURL = (targetURL: URL, currentURL: URL, ignoreScheme?: boolean) => {
    if (targetURL.host !== currentURL.host) {
        return false;
    }

    if (!equalUrlsWithSubpath(targetURL, currentURL, ignoreScheme) && !(targetURL.pathname || '/').startsWith(currentURL.pathname)) {
        return false;
    }

    return true;
};

export const isTrustedURL = (url: URL, rootURL: URL) => {
    const parsedURL = parseURL(url);
    const rootParsedURL = parseURL(rootURL);
    if (!parsedURL || !rootParsedURL) {
        return false;
    }
    return (getFormattedPathName(rootParsedURL.pathname) !== '/' && equalUrlsWithSubpath(rootParsedURL, parsedURL)) ||
        (getFormattedPathName(rootParsedURL.pathname) === '/' && equalUrlsIgnoringSubpath(rootParsedURL, parsedURL));
};

export const isUrlType = (urlType: string, serverURL: URL, inputURL: URL) => {
    if (!isInternalURL(inputURL, serverURL)) {
        return false;
    }
    return (getFormattedPathName(inputURL.pathname).startsWith(`${getFormattedPathName(serverURL.pathname)}${urlType}/`) ||
    getFormattedPathName(inputURL.pathname).startsWith(`/${urlType}/`));
};

export const isLoginUrl = (serverURL: URL, inputURL: URL) => isUrlType('login', serverURL, inputURL);
export const isHelpUrl = (serverURL: URL, inputURL: URL) => isUrlType('help', serverURL, inputURL);
export const isImageProxyUrl = (serverURL: URL, inputURL: URL) => isUrlType('api/v4/image', serverURL, inputURL);
export const isPublicFilesUrl = (serverURL: URL, inputURL: URL) => isUrlType('files', serverURL, inputURL);
export const isAdminUrl = (serverURL: URL, inputURL: URL) => isUrlType('admin_console', serverURL, inputURL);
export const isPluginUrl = (serverURL: URL, inputURL: URL) => isUrlType('plugins', serverURL, inputURL);
export const isChannelExportUrl = (serverURL: URL, inputURL: URL) => isUrlType('plugins/com.mattermost.plugin-channel-export/api/v1/export', serverURL, inputURL);
export const isMagicLinkUrl = (serverURL: URL, inputURL: URL) => isUrlType('login/one_time_link', serverURL, inputURL);
export const isManagedResource = (serverURL: URL, inputURL: URL) => [...buildConfig.managedResources].some((testPath) => isUrlType(testPath, serverURL, inputURL));
export const isTeamUrl = (serverURL: URL, inputURL: URL, withApi?: boolean) => {
    if (!isInternalURL(inputURL, serverURL)) {
        return false;
    }

    const paths = [...buildConfig.managedResources, ...nonTeamUrlPaths];

    if (withApi) {
        paths.push('api');
    }
    return !(paths.some((testPath) => isUrlType(testPath, serverURL, inputURL)));
};

export const isCallsPopOutURL = (serverURL: URL, inputURL: URL, callID: string) => {
    const matches = inputURL.pathname.match(new RegExp(`^${escapeRegExp(getFormattedPathName(serverURL.pathname))}([A-Za-z0-9-_]+)/`, 'i'));
    if (matches?.length !== 2) {
        return false;
    }

    const teamName = matches[1];
    const subPath = `${teamName}/${CALLS_PLUGIN_ID}/expanded/${callID}`;

    return isUrlType(subPath, serverURL, inputURL);
};

/**
 * Helper functions
 */

// next two functions are defined to clarify intent
const equalUrlsWithSubpath = (url1: URL, url2: URL, ignoreScheme?: boolean) => {
    if (ignoreScheme) {
        return url1.host === url2.host && getFormattedPathName(url2.pathname).startsWith(getFormattedPathName(url1.pathname));
    }
    return url1.origin === url2.origin && getFormattedPathName(url2.pathname).startsWith(getFormattedPathName(url1.pathname));
};
const equalUrlsIgnoringSubpath = (url1: URL, url2: URL, ignoreScheme?: boolean) => {
    if (ignoreScheme) {
        return url1.host.toLowerCase() === url2.host.toLowerCase();
    }
    return url1.origin.toLowerCase() === url2.origin.toLowerCase();
};

// RegExp string escaping function, as recommended by
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
const escapeRegExp = (s: string) => {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

/**
 * Custom protocol URL handling
 *
 * Many applications (OneNote, MS Teams, Spotify, etc.) use custom protocol schemes
 * that don't strictly follow RFC 3986. These helpers allow us to handle such URLs
 * more leniently while still maintaining basic security checks.
 */

/**
 * Checks if a URL string appears to use a custom (non-http/https) protocol scheme.
 */
export const isCustomProtocolUrl = (url: string): boolean => {
    const schemeMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/?\/?/);
    if (!schemeMatch) {
        return false;
    }
    const scheme = schemeMatch[1].toLowerCase();
    return scheme !== 'http' && scheme !== 'https';
};

/**
 * Normalizes a custom protocol URL to make it parseable by the URL constructor.
 * - Converts Windows-style backslashes to forward slashes
 * - Encodes curly braces which are invalid in RFC 3986 but used by apps like OneNote
 */
export const normalizeCustomProtocolUrl = (url: string): string => {
    // Convert backslashes to forward slashes (Windows paths)
    let normalized = url.replace(/\\/g, '/');

    // Encode curly braces (used by OneNote for page IDs, SharePoint for list IDs)
    normalized = normalized.replace(/\{/g, '%7B').replace(/\}/g, '%7D');

    return normalized;
};

/**
 * Checks for potentially dangerous patterns in URLs that could be used for command injection.
 * This is a security measure when handling custom protocol URLs that bypass strict RFC validation.
 */
export const hasCommandInjectionPatterns = (url: string): boolean => {
    // Check for common command injection patterns
    // These patterns could be used to inject shell commands when passed to shell.openExternal
    const dangerousPatterns = [
        /["'`]/, // Quote characters that could break out of string context
        /\s--\w/, // Command-line flags
        /\|\|/, // Shell OR operator
        /&&/, // Shell AND operator
        /[;<>|]/, // Shell metacharacters
        /\$\(/, // Command substitution
        /`[^`]+`/, // Backtick command substitution
    ];

    return dangerousPatterns.some((pattern) => pattern.test(url));
};

/**
 * Attempts to parse a custom protocol URL, applying normalization if needed.
 * Returns the parsed URL or undefined if it cannot be parsed even after normalization.
 */
export const parseCustomProtocolUrl = (url: string): URL | undefined => {
    // First try parsing as-is
    let parsed = parseURL(url);
    if (parsed) {
        return parsed;
    }

    // Try with normalization for custom protocols
    if (isCustomProtocolUrl(url)) {
        const normalized = normalizeCustomProtocolUrl(url);
        parsed = parseURL(normalized);
    }

    return parsed;
};
