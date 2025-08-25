// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {validateCertificateStore} from 'common/Validator';

import {CertificateStore} from './certificateStore';

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

jest.mock('common/Validator', () => ({
    validateCertificateStore: jest.fn(),
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
}));

const certificateData = {
    'https://server-1.com': {
        data: 'someRandomData',
        issuerName: 'someIssuer',
        dontTrust: false,
    },
    'https://server-2.com': {
        data: 'someRandomData',
        issuerName: 'someIssuer',
        dontTrust: true,
    },
};

describe('main/certificateStore', () => {
    it('should fail gracefully when loaded data is malformed', () => {
        validateCertificateStore.mockImplementation(() => null);

        let certificateStore;
        expect(() => {
            certificateStore = new CertificateStore('someFilename');
        }).not.toThrow(Error);
        expect(certificateStore.data).toStrictEqual({});
    });

    describe('isTrusted', () => {
        let certificateStore;
        beforeAll(() => {
            validateCertificateStore.mockImplementation((data) => JSON.parse(data));
            fs.readFileSync.mockImplementation(() => JSON.stringify(certificateData));
            certificateStore = new CertificateStore('someFilename');
        });

        it('should return true for stored matching certificate', () => {
            certificateStore = new CertificateStore('someFilename');

            expect(certificateStore.isTrusted(new URL('https://server-1.com'), {
                data: 'someRandomData',
                issuerName: 'someIssuer',
            })).toBe(true);
        });

        it('should return false for missing url', () => {
            expect(certificateStore.isTrusted(new URL('https://server-3.com'), {
                data: 'someRandomData',
                issuerName: 'someIssuer',
            })).toBe(false);
        });

        it('should return false for unmatched cert', () => {
            expect(certificateStore.isTrusted(new URL('https://server-1.com'), {
                data: 'someOtherRandomData',
                issuerName: 'someIssuer',
            })).toBe(false);

            expect(certificateStore.isTrusted(new URL('https://server-1.com'), {
                data: 'someRandomData',
                issuerName: 'someOtherIssuer',
            })).toBe(false);
        });

        it('should add certificate for websocket too', () => {
            const certOrigin = 'https://server-websocket.com';
            const wssCertOrigin = certOrigin.replace('https', 'wss');
            const certData = {
                data: 'someRandomData',
                issuerName: 'someIssuer',
            };

            certificateStore = new CertificateStore('someFilename');
            certificateStore.add(new URL(certOrigin), certData);
            expect(certificateStore.isTrusted(new URL(wssCertOrigin), certData)).toBe(true);
        });
    });

    describe('isExplicitlyUntrusted', () => {
        let certificateStore;
        beforeAll(() => {
            validateCertificateStore.mockImplementation((data) => JSON.parse(data));
            fs.readFileSync.mockImplementation(() => JSON.stringify(certificateData));
            certificateStore = new CertificateStore('someFilename');
        });

        it('should return true for explicitly untrusted cert', () => {
            expect(certificateStore.isExplicitlyUntrusted(new URL('https://server-2.com'), {
                data: 'someRandomData',
                issuerName: 'someIssuer',
            })).toBe(true);
        });

        it('should return false for trusted cert', () => {
            expect(certificateStore.isExplicitlyUntrusted(new URL('https://server-1.com'), {
                data: 'someRandomData',
                issuerName: 'someIssuer',
            })).toBe(false);
        });
    });
});
