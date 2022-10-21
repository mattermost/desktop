// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebRequestManager} from './webRequestManager';

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
});
