// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {net, session} from 'electron';

import {getServerAPI} from './serverAPI';

const validURL = 'http://server-1.com/api/endpoint';
const testData = {
    name: 'some data',
    value: 'some more data',
};

jest.mock('electron', () => ({
    net: {
        request: jest.fn().mockImplementation(({url}) => ({
            on: jest.fn().mockImplementation((_, requestCallback) => {
                requestCallback({
                    on: jest.fn().mockImplementation((event, responseCallback) => {
                        if (event === 'data') {
                            responseCallback(JSON.stringify(testData));
                        }
                        if (event === 'end') {
                            responseCallback();
                        }
                    }),
                    statusCode: url === validURL ? 200 : 404,
                });
            }),
            end: jest.fn(),
        })),
    },
    session: {
        defaultSession: {
            cookies: {
                get: jest.fn(),
            },
        },
    },
}));

describe('main/server/serverAPI', () => {
    it('should call onSuccess with parsed data when successful', async () => {
        const successFn = jest.fn();
        await getServerAPI(
            validURL,
            false,
            successFn,
        );
        expect(successFn).toHaveBeenCalledWith(JSON.stringify(testData));
    });

    it('should call onError when bad status code received', async () => {
        const successFn = jest.fn();
        const errorFn = jest.fn();
        await getServerAPI(
            'http://badurl.com',
            false,
            successFn,
            null,
            errorFn,
        );
        expect(successFn).not.toHaveBeenCalled();
        expect(errorFn).toHaveBeenCalled();
    });

    it('should call onError when response encounters an error', async () => {
        net.request.mockImplementation(({url}) => ({
            on: jest.fn().mockImplementation((_, requestCallback) => {
                requestCallback({
                    on: jest.fn().mockImplementation((event, responseCallback) => {
                        if (event === 'error') {
                            responseCallback();
                        }
                    }),
                    statusCode: url === validURL ? 200 : 404,
                });
            }),
            end: jest.fn(),
        }));

        const successFn = jest.fn();
        const errorFn = jest.fn();
        await getServerAPI(
            validURL,
            false,
            successFn,
            null,
            errorFn,
        );
        expect(errorFn).toHaveBeenCalled();
    });

    it('should call onAbort when request aborts', async () => {
        net.request.mockImplementation(() => ({
            on: jest.fn().mockImplementation((event, requestCallback) => {
                if (event === 'abort') {
                    requestCallback();
                }
            }),
            end: jest.fn(),
        }));

        const successFn = jest.fn();
        const abortFn = jest.fn();
        await getServerAPI(
            validURL,
            false,
            successFn,
            abortFn,
            null,
        );
        expect(abortFn).toHaveBeenCalled();
    });

    it('should call onError when request errors', async () => {
        net.request.mockImplementation(() => ({
            on: jest.fn().mockImplementation((event, requestCallback) => {
                if (event === 'error') {
                    requestCallback();
                }
            }),
            end: jest.fn(),
        }));

        const successFn = jest.fn();
        const errorFn = jest.fn();
        await getServerAPI(
            validURL,
            false,
            successFn,
            null,
            errorFn,
        );
        expect(errorFn).toHaveBeenCalled();
    });

    it('should do nothing when all cookies are missing for authenticated request', async () => {
        const successFn = jest.fn();
        await getServerAPI(
            validURL,
            true,
            successFn,
        );
        expect(net.request).not.toBeCalled();
    });

    it('should do nothing when some cookies are missing for authenticated request', async () => {
        session.defaultSession.cookies.get.mockImplementation(() => ([
            {
                domain: 'http://server-1.com',
                name: 'MMUSERID',
            },
        ]));
        const successFn = jest.fn();
        await getServerAPI(
            validURL,
            true,
            successFn,
        );
        expect(net.request).not.toBeCalled();
    });

    it('should continue when all cookies are present', async () => {
        session.defaultSession.cookies.get.mockImplementation(() => ([
            {
                domain: 'http://server-1.com',
                name: 'MMUSERID',
            },
            {
                domain: 'http://server-1.com',
                name: 'MMCSRF',
            },
            {
                domain: 'http://server-1.com',
                name: 'MMAUTHTOKEN',
            },
        ]));
        const successFn = jest.fn();
        await getServerAPI(
            validURL,
            true,
            successFn,
        );
        expect(net.request).toBeCalled();
    });
});
