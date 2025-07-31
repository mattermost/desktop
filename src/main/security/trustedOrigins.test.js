// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {BASIC_AUTH_PERMISSION} from 'common/permissions';
import {TrustedOriginsStore} from 'main/trustedOrigins';

jest.mock('path', () => ({
    resolve: jest.fn(),
}));

jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(),
    },
    ipcMain: {
        on: jest.fn(),
    },
}));

function mockTOS(fileName, returnvalue) {
    const tos = new TrustedOriginsStore(fileName);
    tos.readFromFile = () => {
        return returnvalue;
    };
    return tos;
}

describe('Trusted Origins', () => {
    describe('validate load', () => {
        it('should be empty if there is no file', () => {
            const tos = mockTOS('emptyfile', null);
            tos.load();
            expect(tos.data.size).toStrictEqual(0);
        });

        it('should throw an error if data isn\'t an object', () => {
            const tos = mockTOS('notobject', 'this is not my object!');

            expect(() => {
                tos.load();
            }).toThrow(SyntaxError);
        });

        it('should throw an error if data isn\'t in the expected format', () => {
            const tos = mockTOS('badobject', '{"https://mattermost.com": "this is not my object!"}');
            expect(() => {
                tos.load();
            }).toThrow(/^Provided TrustedOrigins file does not validate, using defaults instead\.$/);
        });

        it('should drop keys that aren\'t urls', () => {
            const tos = mockTOS('badobject2', `{"this is not an uri": {"${BASIC_AUTH_PERMISSION}": true}}`);
            tos.load();
            expect(typeof tos.data['this is not an uri']).toBe('undefined');
        });

        it('should contain valid data if everything goes right', () => {
            const value = {
                'https://mattermost.com': {
                    [BASIC_AUTH_PERMISSION]: true,
                }};
            const tos = mockTOS('okfile', JSON.stringify(value));
            tos.load();
            expect(Object.fromEntries(tos.data.entries())).toStrictEqual(value);
        });
    });
    describe('validate testing permissions', () => {
        const value = {
            'https://mattermost.com': {
                [BASIC_AUTH_PERMISSION]: true,
            },
            'https://notmattermost.com': {
                [BASIC_AUTH_PERMISSION]: false,
            },
        };
        const tos = mockTOS('permission_test', JSON.stringify(value));
        tos.load();
        it('tos should contain 2 elements', () => {
            expect(tos.data.size).toBe(2);
        });
        it('should say ok if the permission is set', () => {
            expect(tos.checkPermission(new URL('https://mattermost.com'), BASIC_AUTH_PERMISSION)).toBe(true);
        });
        it('should say ko if the permission is set to false', () => {
            expect(tos.checkPermission(new URL('https://notmattermost.com'), BASIC_AUTH_PERMISSION)).toBe(false);
        });
        it('should say ko if the uri is not set', () => {
            expect(tos.checkPermission(new URL('https://undefined.com'), BASIC_AUTH_PERMISSION)).toBe(undefined);
        });
        it('should say null if the permission is unknown', () => {
            expect(tos.checkPermission(new URL('https://mattermost.com'))).toBe(null);
        });
    });

    describe('validate deleting permissions', () => {
        const value = {
            'https://mattermost.com': {
                [BASIC_AUTH_PERMISSION]: true,
            },
            'https://notmattermost.com': {
                [BASIC_AUTH_PERMISSION]: false,
            },
        };
        const tos = mockTOS('permission_test', JSON.stringify(value));
        tos.load();
        it('deleting revokes access', () => {
            expect(tos.checkPermission(new URL('https://mattermost.com'), BASIC_AUTH_PERMISSION)).toBe(true);
            tos.delete(new URL('https://mattermost.com'));
            expect(tos.checkPermission(new URL('https://mattermost.com'), BASIC_AUTH_PERMISSION)).toBe(undefined);
        });
    });
});
