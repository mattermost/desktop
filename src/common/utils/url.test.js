// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {
    getFormattedPathName,
    isUrlType,
    isValidURL,
    isValidURI,
    parseURL,
    isInternalURL,
    isCallsPopOutURL,
    isTrustedURL,
} from 'common/utils/url';

jest.mock('common/views/View', () => ({
    getServerView: (srv, view) => {
        return {
            name: `${srv.name}_${view.name}`,
            url: `${srv.url}${srv.url.toString().endsWith('/') ? '' : '/'}${view.name.split('-')[1] || ''}`,
        };
    },
}));

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
