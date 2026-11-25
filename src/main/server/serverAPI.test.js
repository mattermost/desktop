// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {net, session} from 'electron';

import {getServerAPI, requestPluginAuthHandoff} from './serverAPI';

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
                    message: url === validURL ? 'OK' : 'Not Found',
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
                    message: url === validURL ? 'OK' : 'Not Found',
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
                    requestCallback({message: 'Error'});
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

    describe('requestPluginAuthHandoff', () => {
        const authCookies = [
            {domain: 'server-1.com', name: 'MMUSERID', value: 'user-1'},
            {domain: 'server-1.com', name: 'MMCSRF', value: 'csrf-123'},
            {domain: 'server-1.com', name: 'MMAUTHTOKEN', value: 'token-abc'},
        ];

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should POST target_path with CSRF header and return handoff URL', async () => {
            session.defaultSession.cookies.get.mockResolvedValue(authCookies);
            const setHeader = jest.fn();
            const write = jest.fn();
            const end = jest.fn();
            net.request.mockImplementation(() => ({
                setHeader,
                write,
                end,
                on: jest.fn((event, cb) => {
                    if (event === 'response') {
                        cb({
                            statusCode: 200,
                            on: jest.fn((respEvent, respCb) => {
                                if (respEvent === 'data') {
                                    respCb(JSON.stringify({token: 'handoff-token-1'}));
                                }
                                if (respEvent === 'end') {
                                    respCb();
                                }
                            }),
                        });
                    }
                }),
            }));

            const result = await requestPluginAuthHandoff(
                new URL('https://server-1.com/subpath'),
                '/subpath/plugins/github/oauth/connect?private=true',
            );

            expect(net.request).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://server-1.com/subpath/api/v4/users/me/plugin_auth_handoff',
                session: session.defaultSession,
                useSessionCookies: true,
            });
            expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(setHeader).toHaveBeenCalledWith('X-CSRF-Token', 'csrf-123');
            expect(write).toHaveBeenCalledWith(JSON.stringify({target_path: '/subpath/plugins/github/oauth/connect?private=true'}));
            expect(end).toHaveBeenCalled();
            expect(result.toString()).toBe('https://server-1.com/subpath/auth/plugin_handoff?token=handoff-token-1');
        });

        it('should reject when required cookies are missing', async () => {
            session.defaultSession.cookies.get.mockResolvedValue([]);

            await expect(requestPluginAuthHandoff(
                new URL('https://server-1.com'),
                '/plugins/github/oauth/connect',
            )).rejects.toThrow('required cookies not found');
            expect(net.request).not.toHaveBeenCalled();
        });

        it('should reject on non-200 status code', async () => {
            session.defaultSession.cookies.get.mockResolvedValue(authCookies);
            net.request.mockImplementation(() => ({
                setHeader: jest.fn(),
                write: jest.fn(),
                end: jest.fn(),
                on: jest.fn((event, cb) => {
                    if (event === 'response') {
                        cb({statusCode: 404, on: jest.fn()});
                    }
                }),
            }));

            await expect(requestPluginAuthHandoff(
                new URL('https://server-1.com'),
                '/plugins/github/oauth/connect',
            )).rejects.toThrow('Bad status code 404');
        });
    });
});
