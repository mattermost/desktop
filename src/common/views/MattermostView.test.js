// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import ServerManager from 'common/servers/serverManager';
import {isInternalURL, parseURL} from 'common/utils/url';

import {MattermostView, ViewType} from './MattermostView';

jest.mock('common/servers/serverManager', () => ({
    getServer: jest.fn(),
}));

jest.mock('common/utils/url', () => ({
    parseURL: jest.fn(),
    isInternalURL: jest.fn(),
}));

describe('MattermostView', () => {
    describe('getLoadingURL', () => {
        let mockServer;

        beforeEach(() => {
            mockServer = {
                id: 'test-server-id',
                name: 'Test Server',
                url: new URL('https://test.com'),
                initialLoadURL: new URL('https://test.com'),
            };

            ServerManager.getServer.mockReturnValue(mockServer);
            parseURL.mockImplementation((url) => {
                try {
                    return new URL(url);
                } catch {
                    return null;
                }
            });
            isInternalURL.mockReturnValue(true);
        });

        it('should throw error when server not found', () => {
            ServerManager.getServer.mockReturnValue(null);
            const view = new MattermostView(mockServer, ViewType.TAB);
            expect(() => view.getLoadingURL()).toThrow('Server test-server-id not found');
        });

        it('should return server URL when no initial path', () => {
            const view = new MattermostView(mockServer, ViewType.TAB);
            expect(view.getLoadingURL()).toEqual(mockServer.url);
        });

        it('should use initialLoadURL when available', () => {
            const initialLoadURL = new URL('https://initial.test.com');
            mockServer.initialLoadURL = initialLoadURL;
            const view = new MattermostView(mockServer, ViewType.TAB);

            expect(view.getLoadingURL()).toEqual(initialLoadURL);
        });

        it('should fall back to server URL when initialLoadURL is not available', () => {
            delete mockServer.initialLoadURL;
            const view = new MattermostView(mockServer, ViewType.TAB);

            expect(view.getLoadingURL()).toEqual(mockServer.url);
        });

        it('should append initial path to root pathname', () => {
            mockServer.url = new URL('https://test.com/');
            const view = new MattermostView(mockServer, ViewType.TAB, '/channels/town-square');

            expect(view.getLoadingURL().toString()).toBe('https://test.com/channels/town-square');
        });

        it('should preserve query string in initial path for root pathname', () => {
            mockServer.url = new URL('https://test.com/');
            const view = new MattermostView(mockServer, ViewType.TAB, '/channels/town-square?teid=test-team-id');

            expect(view.getLoadingURL().toString()).toBe('https://test.com/channels/town-square?teid=test-team-id');
        });

        it('should preserve query string in initial path for root pathname with a subpath', () => {
            mockServer.url = new URL('https://test.com/subpath');
            const view = new MattermostView(mockServer, ViewType.TAB, '/channels/town-square?teid=test-team-id&channel_id=test-channel-id');

            expect(view.getLoadingURL().toString()).toBe('https://test.com/subpath/channels/town-square?teid=test-team-id&channel_id=test-channel-id');
        });

        it('should throw error when URL is not valid for root pathname', () => {
            mockServer.url = new URL('https://test.com/');
            parseURL.mockReturnValue(null);
            const view = new MattermostView(mockServer, ViewType.TAB, '/channels/town-square');

            expect(() => view.getLoadingURL()).toThrow('URL for server test-server-id is not valid');
        });

        it('should append initial path to existing pathname', () => {
            const serverWithExistingPath = {
                ...mockServer,
                url: new URL('https://test.com/existing'),
                initialLoadURL: new URL('https://test.com/existing'),
            };
            ServerManager.getServer.mockReturnValue(serverWithExistingPath);
            const view = new MattermostView(serverWithExistingPath, ViewType.TAB, '/channels/town-square');
            expect(view.getLoadingURL().toString()).toBe('https://test.com/existing/channels/town-square');
        });

        it('should throw error when URL is not valid for existing pathname', () => {
            mockServer.url = new URL('https://test.com/existing');
            parseURL.mockReturnValue(null);
            const view = new MattermostView(mockServer, ViewType.TAB, '/channels/town-square');

            expect(() => view.getLoadingURL()).toThrow('URL for server test-server-id is not valid');
        });

        it('should handle initial path without leading slash', () => {
            mockServer.url = new URL('https://test.com/');
            const view = new MattermostView(mockServer, ViewType.TAB, 'channels/town-square');
            expect(view.getLoadingURL().toString()).toBe('https://test.com/channels/town-square');
        });

        it('should handle initial path with leading slash', () => {
            mockServer.url = new URL('https://test.com/');
            const view = new MattermostView(mockServer, ViewType.TAB, '/channels/town-square');
            expect(view.getLoadingURL().toString()).toBe('https://test.com/channels/town-square');
        });
    });
});
