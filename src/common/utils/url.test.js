// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {
    getFormattedPathName,
    hasCommandInjectionPatterns,
    isCustomProtocolUrl,
    isUrlType,
    isValidURL,
    isValidURI,
    normalizeCustomProtocolUrl,
    parseCustomProtocolUrl,
    parseURL,
    isInternalURL,
    isCallsPopOutURL,
    isTrustedURL,
} from 'common/utils/url';

describe('common/utils/url', () => {
    describe('getFormattedPathName', () => {
        it('should add trailing slash', () => {
            const unformattedPathName = '/aAbBbB/cC/DdeR';
            expect(getFormattedPathName(unformattedPathName)).toBe('/aAbBbB/cC/DdeR/');
        });
    });
    describe('parseURL', () => {
        it('should return the URL if it is already a URL', () => {
            const url = new URL('http://mattermost.com');
            expect(parseURL(url)).toBe(url);
        });

        it('should return undefined when a bad url is passed', () => {
            const badURL = 'not-a-real-url-at-all';
            expect(parseURL(badURL)).toBe(undefined);
        });

        it('should remove duplicate slashes in a URL when parsing', () => {
            const urlWithExtraSlashes = 'https://mattermost.com//sub//path//example';
            const parsedURL = parseURL(urlWithExtraSlashes);

            expect(parsedURL.toString()).toBe('https://mattermost.com/sub/path/example');
        });
    });

    describe('isValidURL', () => {
        it('should be true for a valid web url', () => {
            const testURL = 'https://developers.mattermost.com/';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https web url', () => {
            const testURL = 'http://developers.mattermost.com/';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for an invalid, self-defined, top-level domain', () => {
            const testURL = 'https://www.example.x';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a file download url', () => {
            const testURL = 'https://community.mattermost.com/api/v4/files/ka3xbfmb3ffnmgdmww8otkidfw?download=1';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a permalink url', () => {
            const testURL = 'https://community.mattermost.com/test-channel/pl/pdqowkij47rmbyk78m5hwc7r6r';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, internal domain', () => {
            const testURL = 'https://mattermost.company-internal';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a second, valid internal domain', () => {
            const testURL = 'https://serverXY/mattermost';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https internal domain', () => {
            const testURL = 'http://mattermost.local';
            expect(isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https, ip address with port number', () => {
            const testURL = 'http://localhost:8065';
            expect(isValidURL(testURL)).toBe(true);
        });
    });
    describe('isValidURI', () => {
        it('should be true for a deeplink url', () => {
            const testURL = 'mattermost://community-release.mattermost.com/core/channels/developers';
            expect(isValidURI(testURL)).toBe(true);
        });
        it('should be false for a malicious url', () => {
            const testURL = String.raw`mattermost:///" --data-dir "\\deans-mbp\mattermost`;
            expect(isValidURI(testURL)).toBe(false);
        });
    });

    describe('isCustomProtocolUrl', () => {
        it('should return true for onenote protocol', () => {
            expect(isCustomProtocolUrl('onenote:///D:/OneNote/Apps/Test.one')).toBe(true);
        });
        it('should return true for spotify protocol', () => {
            expect(isCustomProtocolUrl('spotify:album:2OZbaW9tgO62ndm375lFZr')).toBe(true);
        });
        it('should return true for msteams protocol', () => {
            expect(isCustomProtocolUrl('msteams://teams.microsoft.com/l/chat')).toBe(true);
        });
        it('should return true for mattermost protocol', () => {
            expect(isCustomProtocolUrl('mattermost://server.com/team/channel')).toBe(true);
        });
        it('should return false for http protocol', () => {
            expect(isCustomProtocolUrl('http://example.com')).toBe(false);
        });
        it('should return false for https protocol', () => {
            expect(isCustomProtocolUrl('https://example.com')).toBe(false);
        });
        it('should return false for invalid URL without scheme', () => {
            expect(isCustomProtocolUrl('not-a-url')).toBe(false);
        });
    });

    describe('normalizeCustomProtocolUrl', () => {
        it('should convert backslashes to forward slashes', () => {
            const input = String.raw`onenote:///D:\OneNote\Apps\Test.one`;
            expect(normalizeCustomProtocolUrl(input)).toBe('onenote:///D:/OneNote/Apps/Test.one');
        });
        it('should encode curly braces', () => {
            const input = 'onenote:///path#section&page-id={840EDD0C-B6FB-481E-A342-E39AEDA50EE6}';
            expect(normalizeCustomProtocolUrl(input)).toBe('onenote:///path#section&page-id=%7B840EDD0C-B6FB-481E-A342-E39AEDA50EE6%7D');
        });
        it('should handle both backslashes and curly braces', () => {
            const input = String.raw`onenote:///D:\OneNote\Apps\Test.one#Page&page-id={GUID}`;
            expect(normalizeCustomProtocolUrl(input)).toBe('onenote:///D:/OneNote/Apps/Test.one#Page&page-id=%7BGUID%7D');
        });
        it('should not modify URLs without special characters', () => {
            const input = 'spotify:album:2OZbaW9tgO62ndm375lFZr';
            expect(normalizeCustomProtocolUrl(input)).toBe(input);
        });
    });

    describe('hasCommandInjectionPatterns', () => {
        it('should detect double quotes', () => {
            expect(hasCommandInjectionPatterns('protocol://path" --flag')).toBe(true);
        });
        it('should detect single quotes', () => {
            expect(hasCommandInjectionPatterns("protocol://path' --flag")).toBe(true);
        });
        it('should detect command-line flags pattern', () => {
            expect(hasCommandInjectionPatterns('protocol://path --data-dir /malicious')).toBe(true);
        });
        it('should detect shell OR operator', () => {
            expect(hasCommandInjectionPatterns('protocol://path || rm -rf')).toBe(true);
        });
        it('should detect shell AND operator', () => {
            expect(hasCommandInjectionPatterns('protocol://path && malicious')).toBe(true);
        });
        it('should detect semicolons', () => {
            expect(hasCommandInjectionPatterns('protocol://path; malicious')).toBe(true);
        });
        it('should detect pipe operator', () => {
            expect(hasCommandInjectionPatterns('protocol://path | malicious')).toBe(true);
        });
        it('should detect command substitution', () => {
            expect(hasCommandInjectionPatterns('protocol://$(whoami)')).toBe(true);
        });
        it('should detect backtick command substitution', () => {
            expect(hasCommandInjectionPatterns('protocol://`whoami`')).toBe(true);
        });
        it('should allow safe OneNote URL', () => {
            expect(hasCommandInjectionPatterns('onenote:///D:/OneNote/Apps/Test.one#Page%20Title&page-id=%7B840EDD0C-B6FB-481E-A342-E39AEDA50EE6%7D')).toBe(false);
        });
        it('should allow safe Spotify URL', () => {
            expect(hasCommandInjectionPatterns('spotify:album:2OZbaW9tgO62ndm375lFZr')).toBe(false);
        });
        it('should allow safe MS Teams URL', () => {
            expect(hasCommandInjectionPatterns('msteams://teams.microsoft.com/l/chat/0/0')).toBe(false);
        });
    });

    describe('parseCustomProtocolUrl', () => {
        it('should parse standard http URL without normalization', () => {
            const result = parseCustomProtocolUrl('http://example.com/path');
            expect(result).toBeDefined();
            expect(result.href).toBe('http://example.com/path');
        });
        it('should parse OneNote URL with backslashes after normalization', () => {
            const input = String.raw`onenote:///D:\OneNote\Apps\Test.one`;
            const result = parseCustomProtocolUrl(input);
            expect(result).toBeDefined();
            expect(result.protocol).toBe('onenote:');
        });
        it('should parse OneNote URL with curly braces after normalization', () => {
            const input = 'onenote:///D:/OneNote/Apps/Test.one#Page&page-id={GUID}';
            const result = parseCustomProtocolUrl(input);
            expect(result).toBeDefined();
            expect(result.protocol).toBe('onenote:');
        });
        it('should parse SharePoint URL with curly braces after normalization', () => {
            const input = 'http://server/path/_layouts/listform.aspx?ListId={2E982C3E-A485-4AC9-8093-CC00C8B36197}';
            const result = parseCustomProtocolUrl(input);
            expect(result).toBeDefined();
            expect(result.host).toBe('server');
        });
        it('should return undefined for completely invalid URL', () => {
            const result = parseCustomProtocolUrl('not-a-valid-url-at-all');
            expect(result).toBeUndefined();
        });
    });
    describe('isInternalURL', () => {
        it('should return false on different hosts', () => {
            const baseURL = new URL('http://mattermost.com');
            const externalURL = new URL('http://google.com');

            expect(isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return false on different ports', () => {
            const baseURL = new URL('http://mattermost.com:8080');
            const externalURL = new URL('http://mattermost.com:9001');

            expect(isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return false on different subpaths', () => {
            const baseURL = new URL('http://mattermost.com/sub/path/');
            const externalURL = new URL('http://mattermost.com/different/sub/path');

            expect(isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return true if matching', () => {
            const baseURL = new URL('http://mattermost.com/');
            const externalURL = new URL('http://mattermost.com');

            expect(isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('should return true if matching with subpath', () => {
            const baseURL = new URL('http://mattermost.com/sub/path/');
            const externalURL = new URL('http://mattermost.com/sub/path');

            expect(isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('should return true if subpath of', () => {
            const baseURL = new URL('http://mattermost.com/');
            const externalURL = new URL('http://mattermost.com/sub/path');

            expect(isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('same host, different URL scheme, with ignore scheme', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('mattermost://server-1.com');
            expect(isInternalURL(url1, url2, true)).toBe(true);
        });
    });
    describe('isTrustedURL', () => {
        it('base urls', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('http://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(true);
        });

        it('different urls', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('http://server-2.com');
            expect(isTrustedURL(url1, url2)).toBe(false);
        });

        it('same host, different subpath', () => {
            const url1 = new URL('http://server-1.com/subpath');
            const url2 = new URL('http://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(true);
        });

        it('same host and subpath', () => {
            const url1 = new URL('http://server-1.com/subpath');
            const url2 = new URL('http://server-1.com/subpath');
            expect(isTrustedURL(url1, url2)).toBe(true);
        });

        it('same host, different URL scheme', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('mattermost://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(false);
        });

        it('same host, different ports', () => {
            const url1 = new URL('http://server-1.com:8080');
            const url2 = new URL('http://server-1.com');
            expect(isTrustedURL(url1, url2)).toBe(false);
        });
    });

    describe('isUrlType', () => {
        const serverURL = new URL('http://mattermost.com');
        const urlType = 'url-type';

        it('should identify base url', () => {
            const adminURL = new URL(`http://mattermost.com/${urlType}`);
            expect(isUrlType('url-type', serverURL, adminURL)).toBe(true);
        });

        it('should identify url of correct type', () => {
            const adminURL = new URL(`http://mattermost.com/${urlType}/some/path`);
            expect(isUrlType('url-type', serverURL, adminURL)).toBe(true);
        });

        it('should not identify other url', () => {
            const adminURL = new URL('http://mattermost.com/some/other/path');
            expect(isUrlType('url-type', serverURL, adminURL)).toBe(false);
        });
    });

    describe('isCallsPopOutURL', () => {
        it('should match correct URL', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(true);
        });

        it('should match with subpath', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org/subpath'),
                new URL('http://example.org/subpath/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(true);
        });

        it('should match with teamname with dash', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/team-name/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(true);
        });

        it('should not match with invalid team name', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/invalid$team/com.mattermost.calls/expanded/othercallid'),
                'callid',
            )).toBe(false);
        });

        it('should not match with incorrect callid', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.org'),
                new URL('http://example.org/team/com.mattermost.calls/expanded/othercallid'),
                'callid',
            )).toBe(false);
        });

        it('should not match with incorrect origin', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.com'),
                new URL('http://example.org/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(false);
        });

        it('should match with regex path embedded', () => {
            expect(isCallsPopOutURL(
                new URL('http://example.com/path(a+)+'),
                new URL('http://example.org//path\\(a\\+\\)\\+/team/com.mattermost.calls/expanded/callid'),
                'callid',
            )).toBe(false);
        });
    });
});
