// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {Certificate} from 'electron';

import {ComparableCertificate} from 'types/certificate';

import urlUtils from 'common/utils/url';

import * as Validator from './Validator';

function comparableCertificate(certificate: Certificate): ComparableCertificate {
    return {
        data: certificate.data.toString(),
        issuerName: certificate.issuerName,
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

export default class CertificateStore {
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

    add = (targetURL: string, certificate: Certificate) => {
        this.data[urlUtils.getHost(targetURL)] = comparableCertificate(certificate);
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
}
