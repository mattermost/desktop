// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {Certificate, ipcMain} from 'electron';
import log from 'electron-log';

import {ComparableCertificate} from 'types/certificate';

import {UPDATE_PATHS} from 'common/communication';
import urlUtils from 'common/utils/url';

import * as Validator from './Validator';
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

    add = (targetURL: string, certificate: Certificate, dontTrust = false) => {
        const host = urlUtils.getHost(targetURL);
        const comparableCert = comparableCertificate(certificate, dontTrust);
        this.data[host] = comparableCert;

        // Trust certificate for websocket connections on the same origin.
        if (host.startsWith('https://')) {
            const wssHost = host.replace('https', 'wss');
            this.data[wssHost] = comparableCert;
        }
    };

    isExisting = (targetURL: string) => {
        return Object.prototype.hasOwnProperty.call(this.data, urlUtils.getHost(targetURL));
    };

    isTrusted = (targetURL: string, certificate: Certificate) => {
        const host = urlUtils.getHost(targetURL);
        if (!this.isExisting(targetURL)) {
            return false;
        }
        return areEqual(this.data[host], comparableCertificate(certificate));
    };

    isExplicitlyUntrusted = (targetURL: string) => {
        // Whether or not the certificate was explicitly marked as untrusted by
        // clicking "Don't ask again" checkbox before cancelling the connection.
        const host = urlUtils.getHost(targetURL);
        const dontTrust = this.data[host]?.dontTrust;
        return dontTrust === undefined ? false : dontTrust;
    }
}

let certificateStore = new CertificateStore(certificateStorePath);
export default certificateStore;

ipcMain.on(UPDATE_PATHS, () => {
    log.debug('certificateStore.UPDATE_PATHS');
    certificateStore = new CertificateStore(certificateStorePath);
});
