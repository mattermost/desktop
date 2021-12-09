// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {validateCertificateStore} from './Validator';

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

jest.mock('./Validator', () => ({
    validateCertificateStore: jest.fn(),
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
}));

const certificateData = {
    'https://server-1.com': {
        data: 'somerandomdata',
        issuerName: 'someissuer',
        dontTrust: false,
    },
    'https://server-2.com': {
        data: 'somerandomdata',
        issuerName: 'someissuer',
        dontTrust: true,
    },
};

describe('main/certificateStore', () => {
    it('should fail gracefully when loaded data is malformed', () => {
        validateCertificateStore.mockImplementation(() => null);

        let certificateStore;
        expect(() => {
            certificateStore = new CertificateStore('somefilename');
        }).not.toThrow(Error);
        expect(certificateStore.data).toStrictEqual({});
    });

    describe('isTrusted', () => {
        let certificateStore;
        beforeAll(() => {
            validateCertificateStore.mockImplementation((data) => JSON.parse(data));
            fs.readFileSync.mockImplementation(() => JSON.stringify(certificateData));
            certificateStore = new CertificateStore('somefilename');
        });

        it('should return true for stored matching certificate', () => {
            certificateStore = new CertificateStore('somefilename');

            expect(certificateStore.isTrusted('https://server-1.com', {
                data: 'somerandomdata',
                issuerName: 'someissuer',
            })).toBe(true);
        });

        it('should return false for missing url', () => {
            expect(certificateStore.isTrusted('https://server-3.com', {
                data: 'somerandomdata',
                issuerName: 'someissuer',
            })).toBe(false);
        });

        it('should return false for unmatching cert', () => {
            expect(certificateStore.isTrusted('https://server-1.com', {
                data: 'someotherrandomdata',
                issuerName: 'someissuer',
            })).toBe(false);

            expect(certificateStore.isTrusted('https://server-1.com', {
                data: 'somerandomdata',
                issuerName: 'someotherissuer',
            })).toBe(false);
        });
    });

    describe('isExplicitlyUntrusted', () => {
        let certificateStore;
        beforeAll(() => {
            validateCertificateStore.mockImplementation((data) => JSON.parse(data));
            fs.readFileSync.mockImplementation(() => JSON.stringify(certificateData));
            certificateStore = new CertificateStore('somefilename');
        });

        it('should return true for explicitly untrusted cert', () => {
            expect(certificateStore.isExplicitlyUntrusted('https://server-2.com', {
                data: 'somerandomdata',
                issuerName: 'someissuer',
            })).toBe(true);
        });

        it('should return false for trusted cert', () => {
            expect(certificateStore.isExplicitlyUntrusted('https://server-1.com', {
                data: 'somerandomdata',
                issuerName: 'someissuer',
            })).toBe(false);
        });
    });
});
