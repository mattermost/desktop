// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebRequestManager} from './webRequestManager';

jest.mock('electron-log', () => ({
    debug: jest.fn(),
    silly: jest.fn(),
}));

jest.mock('main/webRequest/webRequestHandler', () => ({
    WebRequestHandler: jest.fn().mockImplementation(() => ({
        addWebRequestListener: jest.fn(),
        eventNames: jest.fn().mockReturnValue([]),
        removeAllListeners: jest.fn(),
    })),
}));

describe('main/webRequest/webRequestManager', () => {
    describe('onBeforeRequestCallback', () => {
        it('should throw an error when more than one listener provides a redirect url', () => {
            const manager = new WebRequestManager();
            expect(() => {
                manager.onBeforeRequestCallback(
                    {url: 'http://some-url.com'},
                    {redirectURL: 'http://some-other-url.com'},
                    {redirectURL: 'http://some-even-more-other-url.com'},
                );
            }).toThrow(Error);
        });

        it('should override cancel behaviour if any one listener cancels the request', () => {
            const manager = new WebRequestManager();
            expect(manager.onBeforeRequestCallback(
                {url: 'http://some-url.com'},
                {cancel: false},
                {cancel: true},
            )).toStrictEqual({cancel: true});
        });

        it('should add redirect url', () => {
            const manager = new WebRequestManager();
            expect(manager.onBeforeRequestCallback(
                {url: 'http://some-url.com'},
                {},
                {redirectURL: 'http://some-other-url.com'},
            )).toStrictEqual({redirectURL: 'http://some-other-url.com'});
        });
    });

    describe('onBeforeSendHeadersCallback', () => {
        it('should override cancel behaviour if any one listener cancels the request', () => {
            const manager = new WebRequestManager();
            expect(manager.onBeforeSendHeadersCallback(
                {url: 'http://some-url.com', requestHeaders: {some_header: 'value1'}},
                {cancel: false},
                {cancel: true},
            )).toStrictEqual({cancel: true, requestHeaders: {some_header: 'value1'}});
        });

        it('should add and overwrite request headers', () => {
            const manager = new WebRequestManager();
            expect(manager.onBeforeSendHeadersCallback(
                {url: 'http://some-url.com', requestHeaders: {some_header: 'value1'}},
                {requestHeaders: {some_other_header: 'value2'}},
                {requestHeaders: {some_other_header: 'value3', some_other_other_header: 'value4'}},
            )).toStrictEqual({requestHeaders: {
                some_header: 'value1',
                some_other_header: 'value3',
                some_other_other_header: 'value4',
            }});
        });
    });

    describe('onHeadersReceivedCallback', () => {
        it('should override cancel behaviour if any one listener cancels the request', () => {
            const manager = new WebRequestManager();
            expect(manager.onHeadersReceivedCallback(
                {url: 'http://some-url.com', responseHeaders: {some_header: 'value1'}},
                {cancel: false},
                {cancel: true},
            )).toStrictEqual({cancel: true, responseHeaders: {some_header: 'value1'}});
        });

        it('should add and overwrite response headers', () => {
            const manager = new WebRequestManager();
            expect(manager.onHeadersReceivedCallback(
                {url: 'http://some-url.com', responseHeaders: {some_header: 'value1'}},
                {responseHeaders: {some_other_header: 'value2'}},
                {responseHeaders: {some_other_header: 'value3', some_other_other_header: 'value4'}},
            )).toStrictEqual({responseHeaders: {
                some_header: 'value1',
                some_other_header: 'value3',
                some_other_other_header: 'value4',
            }});
        });
    });

    describe('rewriteURL', () => {
        it('should overwrite old listeners with new ones if the regex matches', () => {
            const manager = new WebRequestManager();
            manager.onBeforeRequest.eventNames = jest.fn().mockReturnValue(['rewriteURL_/file:\\/\\/\\/*/_4']);
            manager.rewriteURL(/file:\/\/\/*/, 'http:', 4);
            expect(manager.onBeforeRequest.removeAllListeners).toHaveBeenCalled();
        });

        it('should not rewrite URLs if the request does not match the web contents id', () => {
            const manager = new WebRequestManager();
            let result = {};
            manager.onBeforeRequest.addWebRequestListener.mockImplementation((name, fn) => {
                result = fn({url: 'file:///some/file/path', webContentsId: 1});
            });
            manager.rewriteURL(/file:\/\/\/*/, 'http://', 2);
            expect(result).not.toHaveProperty('redirectURL');
        });

        it('should not rewrite URLs if the request does not match the regex', () => {
            const manager = new WebRequestManager();
            let result = {};
            manager.onBeforeRequest.addWebRequestListener.mockImplementation((name, fn) => {
                result = fn({url: 'http://some/file/path', webContentsId: 1});
            });
            manager.rewriteURL(/file:\/\/\/*/, 'http://', 1);
            expect(result).not.toHaveProperty('redirectURL');
        });

        it('should rewrite URL correctly', () => {
            const manager = new WebRequestManager();
            let result = {};
            manager.onBeforeRequest.addWebRequestListener.mockImplementation((name, fn) => {
                result = fn({url: 'file:///some/file/path', webContentsId: 1});
            });
            manager.rewriteURL(/file:\/\/\/*/, 'http://', 1);
            expect(result).toHaveProperty('redirectURL', 'http://some/file/path');
        });
    });

    describe('onRequestHeaders', () => {
        it('should not call listener if the web contents id does not match', () => {
            const manager = new WebRequestManager();
            const listener = jest.fn();
            manager.onBeforeSendHeaders.addWebRequestListener.mockImplementation((name, fn) => {
                fn({requestHeaders: {}, webContentsId: 1});
            });
            manager.onRequestHeaders(listener, 2);
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('onResponseHeaders', () => {
        it('should not call listener if the web contents id does not match', () => {
            const manager = new WebRequestManager();
            const listener = jest.fn();
            manager.onHeadersReceived.addWebRequestListener.mockImplementation((name, fn) => {
                fn({responseHeaders: {}, webContentsId: 1});
            });
            manager.onResponseHeaders(listener, 2);
            expect(listener).not.toHaveBeenCalled();
        });
    });
});
