// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import type {Certificate} from 'electron';
import {ipcMain} from 'electron';

import {UPDATE_PATHS} from 'common/communication';
import {Logger} from 'common/log';
import * as Validator from 'common/Validator';

import type {ComparableCertificate} from 'types/certificate';

import {certificateStorePath} from './constants';

function comparableCertificate(certificate: Certificate, dontTrust = false): ComparableCertificate {
    return {
        data: certificate.data.toString(),
        issuerName: certificate.issuerName,
        dontTrust,
    };
}

function areEqual(certificate0: ComparableCertificate, certificate1: ComparableCertificate) {
    if (certificate0.data !== certificate1.data) {
        return false;
    }
    if (certificate0.issuerName !== certificate1.issuerName) {
        return false;
    }
    return true;
}

export class CertificateStore {
    storeFile: string;
    data: Record<string, ComparableCertificate>;

    constructor(storeFile: string) {
        this.storeFile = storeFile;
        let storeStr;
        try {
            storeStr = fs.readFileSync(storeFile, 'utf-8');
            const result = Validator.validateCertificateStore(storeStr);
            if (!result) {
                throw new Error('Provided certificate store file does not validate, using defaults instead.');
            }
            this.data = result;
        } catch (e) {
            this.data = {};
        }
    }

    save = () => {
        fs.writeFileSync(this.storeFile, JSON.stringify(this.data, null, '  '));
    };

    add = (targetURL: URL, certificate: Certificate, dontTrust = false) => {
        const comparableCert = comparableCertificate(certificate, dontTrust);
        this.data[targetURL.origin] = comparableCert;

        // Trust certificate for websocket connections on the same origin.
        if (targetURL.origin.startsWith('https://')) {
            const wssHost = targetURL.origin.replace('https', 'wss');
            this.data[wssHost] = comparableCert;
        }
    };

    isExisting = (targetURL: URL) => {
        return Object.prototype.hasOwnProperty.call(this.data, targetURL.origin);
    };

    isTrusted = (targetURL: URL, certificate: Certificate) => {
        if (!this.isExisting(targetURL)) {
            return false;
        }
        return areEqual(this.data[targetURL.origin], comparableCertificate(certificate));
    };

    isExplicitlyUntrusted = (targetURL: URL) => {
        // Whether or not the certificate was explicitly marked as untrusted by
        // clicking "Don't ask again" checkbox before cancelling the connection.
        const dontTrust = this.data[targetURL.origin]?.dontTrust;
        return dontTrust === undefined ? false : dontTrust;
    };
}

let certificateStore = new CertificateStore(certificateStorePath);
export default certificateStore;

ipcMain.on(UPDATE_PATHS, () => {
    new Logger('certificateStore').debug('UPDATE_PATHS');
    certificateStore = new CertificateStore(certificateStorePath);
});
