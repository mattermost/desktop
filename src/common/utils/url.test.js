// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import urlUtils, {getFormattedPathName, isUrlType, equalUrlsIgnoringSubpath, equalUrlsWithSubpath} from 'common/utils/url';

jest.mock('common/tabs/TabView', () => ({
    getServerView: (srv, tab) => {
        return {
            name: `${srv.name}_${tab.name}`,
            url: `${srv.url}${srv.url.toString().endsWith('/') ? '' : '/'}${tab.name.split('-')[1] || ''}`,
        };
    },
}));

describe('common/utils/url', () => {
    describe('isValidURL', () => {
        it('should be true for a valid web url', () => {
            const testURL = 'https://developers.mattermost.com/';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https web url', () => {
            const testURL = 'http://developers.mattermost.com/';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for an invalid, self-defined, top-level domain', () => {
            const testURL = 'https://www.example.x';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for a file download url', () => {
            const testURL = 'https://community.mattermost.com/api/v4/files/ka3xbfmb3ffnmgdmww8otkidfw?download=1';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for a permalink url', () => {
            const testURL = 'https://community.mattermost.com/test-channel/pl/pdqowkij47rmbyk78m5hwc7r6r';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, internal domain', () => {
            const testURL = 'https://mattermost.company-internal';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for a second, valid internal domain', () => {
            const testURL = 'https://serverXY/mattermost';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https internal domain', () => {
            const testURL = 'http://mattermost.local';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
        it('should be true for a valid, non-https, ip address with port number', () => {
            const testURL = 'http://localhost:8065';
            expect(urlUtils.isValidURL(testURL)).toBe(true);
        });
    });
    describe('isValidURI', () => {
        it('should be true for a deeplink url', () => {
            const testURL = 'mattermost://community-release.mattermost.com/core/channels/developers';
            expect(urlUtils.isValidURI(testURL)).toBe(true);
        });
        it('should be false for a malicious url', () => {
            const testURL = String.raw`mattermost:///" --data-dir "\\deans-mbp\mattermost`;
            expect(urlUtils.isValidURI(testURL)).toBe(false);
        });
    });

    describe('getHost', () => {
        it('should return the origin of a well formed url', () => {
            const myurl = 'https://mattermost.com/download';
            expect(urlUtils.getHost(myurl)).toBe('https://mattermost.com');
        });

        it('shoud raise an error on malformed urls', () => {
            const myurl = 'http://example.com:-80/';
            expect(() => {
                urlUtils.getHost(myurl);
            }).toThrow(SyntaxError);
        });
    });

    describe('parseURL', () => {
        it('should return the URL if it is already a URL', () => {
            const url = new URL('http://mattermost.com');
            expect(urlUtils.parseURL(url)).toBe(url);
        });

        it('should return undefined when a bad url is passed', () => {
            const badURL = 'not-a-real-url-at-all';
            expect(urlUtils.parseURL(badURL)).toBe(undefined);
        });

        it('should remove duplicate slashes in a URL when parsing', () => {
            const urlWithExtraSlashes = 'https://mattermost.com//sub//path//example';
            const parsedURL = urlUtils.parseURL(urlWithExtraSlashes);

            expect(parsedURL.toString()).toBe('https://mattermost.com/sub/path/example');
        });
    });

    describe('isInternalURL', () => {
        it('should return false on different hosts', () => {
            const baseURL = new URL('http://mattermost.com');
            const externalURL = new URL('http://google.com');

            expect(urlUtils.isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return false on different ports', () => {
            const baseURL = new URL('http://mattermost.com:8080');
            const externalURL = new URL('http://mattermost.com:9001');

            expect(urlUtils.isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return false on different subpaths', () => {
            const baseURL = new URL('http://mattermost.com/sub/path/');
            const externalURL = new URL('http://mattermost.com/different/sub/path');

            expect(urlUtils.isInternalURL(externalURL, baseURL)).toBe(false);
        });

        it('should return true if matching', () => {
            const baseURL = new URL('http://mattermost.com/');
            const externalURL = new URL('http://mattermost.com');

            expect(urlUtils.isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('should return true if matching with subpath', () => {
            const baseURL = new URL('http://mattermost.com/sub/path/');
            const externalURL = new URL('http://mattermost.com/sub/path');

            expect(urlUtils.isInternalURL(externalURL, baseURL)).toBe(true);
        });

        it('should return true if subpath of', () => {
            const baseURL = new URL('http://mattermost.com/');
            const externalURL = new URL('http://mattermost.com/sub/path');

            expect(urlUtils.isInternalURL(externalURL, baseURL)).toBe(true);
        });
    });

    describe('getFormattedPathName', () => {
        it('should format all to lower case', () => {
            const unformattedPathName = '/aAbBbB/cC/DdeR/';
            expect(getFormattedPathName(unformattedPathName)).toBe('/aabbbb/cc/dder/');
        });

        it('should add trailing slash', () => {
            const unformattedPathName = '/aAbBbB/cC/DdeR';
            expect(getFormattedPathName(unformattedPathName)).toBe('/aabbbb/cc/dder/');
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

    describe('getView', () => {
        const servers = [
            {
                name: 'server-1',
                url: 'http://server-1.com',
                tabs: [
                    {
                        name: 'tab',
                    },
                    {
                        name: 'tab-type1',
                    },
                    {
                        name: 'tab-type2',
                    },
                ],
            },
            {
                name: 'server-2',
                url: 'http://server-2.com/subpath',
                tabs: [
                    {
                        name: 'tab-type1',
                    },
                    {
                        name: 'tab-type2',
                    },
                    {
                        name: 'tab',
                    },
                ],
            },
        ];

        it('should match the correct server - base URL', () => {
            const inputURL = new URL('http://server-1.com');
            expect(urlUtils.getView(inputURL, servers)).toStrictEqual({name: 'server-1_tab', url: 'http://server-1.com/'});
        });

        it('should match the correct server - base tab', () => {
            const inputURL = new URL('http://server-1.com/team');
            expect(urlUtils.getView(inputURL, servers)).toStrictEqual({name: 'server-1_tab', url: 'http://server-1.com/'});
        });

        it('should match the correct server - different tab', () => {
            const inputURL = new URL('http://server-1.com/type1/app');
            expect(urlUtils.getView(inputURL, servers)).toStrictEqual({name: 'server-1_tab-type1', url: 'http://server-1.com/type1'});
        });

        it('should return undefined for server with subpath and URL without', () => {
            const inputURL = new URL('http://server-2.com');
            expect(urlUtils.getView(inputURL, servers)).toBe(undefined);
        });

        it('should return undefined for server with subpath and URL with wrong subpath', () => {
            const inputURL = new URL('http://server-2.com/different/subpath');
            expect(urlUtils.getView(inputURL, servers)).toBe(undefined);
        });

        it('should match the correct server with a subpath - base URL', () => {
            const inputURL = new URL('http://server-2.com/subpath');
            expect(urlUtils.getView(inputURL, servers)).toStrictEqual({name: 'server-2_tab', url: 'http://server-2.com/subpath/'});
        });

        it('should match the correct server with a subpath - base tab', () => {
            const inputURL = new URL('http://server-2.com/subpath/team');
            expect(urlUtils.getView(inputURL, servers)).toStrictEqual({name: 'server-2_tab', url: 'http://server-2.com/subpath/'});
        });

        it('should match the correct server with a subpath - different tab', () => {
            const inputURL = new URL('http://server-2.com/subpath/type2/team');
            expect(urlUtils.getView(inputURL, servers)).toStrictEqual({name: 'server-2_tab-type2', url: 'http://server-2.com/subpath/type2'});
        });

        it('should return undefined for wrong server', () => {
            const inputURL = new URL('http://server-3.com');
            expect(urlUtils.getView(inputURL, servers)).toBe(undefined);
        });
    });

    describe('equalUrls', () => {
        it('base urls', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('http://server-1.com');
            expect(equalUrlsIgnoringSubpath(url1, url2)).toBe(true);
            expect(equalUrlsWithSubpath(url1, url2)).toBe(true);
        });

        it('different urls', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('http://server-2.com');
            expect(equalUrlsIgnoringSubpath(url1, url2)).toBe(false);
            expect(equalUrlsWithSubpath(url1, url2)).toBe(false);
        });

        it('same host, different subpath', () => {
            const url1 = new URL('http://server-1.com/subpath');
            const url2 = new URL('http://server-1.com');
            expect(equalUrlsIgnoringSubpath(url1, url2)).toBe(true);
            expect(equalUrlsWithSubpath(url1, url2)).toBe(false);
        });

        it('same host and subpath', () => {
            const url1 = new URL('http://server-1.com/subpath');
            const url2 = new URL('http://server-1.com/subpath');
            expect(equalUrlsIgnoringSubpath(url1, url2)).toBe(true);
            expect(equalUrlsWithSubpath(url1, url2)).toBe(true);
        });

        it('same host, different URL scheme', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('mattermost://server-1.com');
            expect(equalUrlsIgnoringSubpath(url1, url2)).toBe(false);
            expect(equalUrlsWithSubpath(url1, url2)).toBe(false);
        });

        it('same host, different URL scheme, with ignore scheme', () => {
            const url1 = new URL('http://server-1.com');
            const url2 = new URL('mattermost://server-1.com');
            expect(equalUrlsIgnoringSubpath(url1, url2, true)).toBe(true);
            expect(equalUrlsWithSubpath(url1, url2, true)).toBe(true);
        });

        it('same host, different ports', () => {
            const url1 = new URL('http://server-1.com:8080');
            const url2 = new URL('http://server-1.com');
            expect(equalUrlsIgnoringSubpath(url1, url2, true)).toBe(false);
            expect(equalUrlsWithSubpath(url1, url2, true)).toBe(false);
        });
    });

    describe('cleanPathName', () => {
        it('should not clean path name if it occurs other than the beginning', () => {
            expect(urlUtils.cleanPathName('/mattermost', '/home/channels/mattermost/test')).toBe('/home/channels/mattermost/test');
        });

        it('should clean path name if it occurs at the beginning', () => {
            expect(urlUtils.cleanPathName('/mattermost', '/mattermost/channels/home/test')).toBe('/channels/home/test');
        });

        it('should do nothing if it doesnt occur', () => {
            expect(urlUtils.cleanPathName('/mattermost', '/channels/home/test')).toBe('/channels/home/test');
        });
    });

    describe('isCustomLoginURL', () => {
        it('should match correct URL', () => {
            expect(urlUtils.isCustomLoginURL(
                'http://server.com/oauth/authorize',
                {
                    url: 'http://server.com',
                },
                [
                    {
                        name: 'a',
                        url: 'http://server.com',
                        tabs: [
                            {
                                name: 'tab',
                            },
                        ],
                    },
                ])).toBe(true);
        });
        it('should not match incorrect URL', () => {
            expect(urlUtils.isCustomLoginURL(
                'http://server.com/oauth/notauthorize',
                {
                    url: 'http://server.com',
                },
                [
                    {
                        name: 'a',
                        url: 'http://server.com',
                        tabs: [
                            {
                                name: 'tab',
                            },
                        ],
                    },
                ])).toBe(false);
        });
        it('should not match base URL', () => {
            expect(urlUtils.isCustomLoginURL(
                'http://server.com/',
                {
                    url: 'http://server.com',
                },
                [
                    {
                        name: 'a',
                        url: 'http://server.com',
                        tabs: [
                            {
                                name: 'tab',
                            },
                        ],
                    },
                ])).toBe(false);
        });
        it('should match with subpath', () => {
            expect(urlUtils.isCustomLoginURL(
                'http://server.com/subpath/oauth/authorize',
                {
                    url: 'http://server.com/subpath',
                },
                [
                    {
                        name: 'a',
                        url: 'http://server.com/subpath',
                        tabs: [
                            {
                                name: 'tab',
                            },
                        ],
                    },
                ])).toBe(true);
        });
        it('should not match with different subpath', () => {
            expect(urlUtils.isCustomLoginURL(
                'http://server.com/subpath/oauth/authorize',
                {
                    url: 'http://server.com/different/subpath',
                },
                [
                    {
                        name: 'a',
                        url: 'http://server.com/different/subpath',
                        tabs: [
                            {
                                name: 'tab',
                            },
                        ],
                    },
                ])).toBe(false);
        });
        it('should not match with oauth subpath', () => {
            expect(urlUtils.isCustomLoginURL(
                'http://server.com/oauth/authorize',
                {
                    url: 'http://server.com/oauth/authorize',
                },
                [
                    {
                        name: 'a',
                        url: 'http://server.com/oauth/authorize',
                        tabs: [
                            {
                                name: 'tab',
                            },
                        ],
                    },
                ])).toBe(false);
        });
    });
});
