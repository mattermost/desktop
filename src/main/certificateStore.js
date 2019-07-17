// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';
import url from 'url';

import * as Validator from './Validator';

function comparableCertificate(certificate) {
  return {
    data: certificate.data.toString(),
    issuerName: certificate.issuerName,
  };
}

function areEqual(certificate0, certificate1) {
  if (certificate0.data !== certificate1.data) {
    return false;
  }
  if (certificate0.issuerName !== certificate1.issuerName) {
    return false;
  }
  return true;
}

function getHost(targetURL) {
  return url.parse(targetURL).host;
}

function CertificateStore(storeFile) {
  this.storeFile = storeFile;
  let storeStr;
  try {
    storeStr = fs.readFileSync(storeFile, 'utf-8');

    // ensure data loaded from file is valid
    storeStr = Validator.validateCertificateStore(storeStr);
    if (!storeStr) {
      throw new Error('Provided certificate store file does not validate, using defaults instead.');
    }
  } catch (e) {
    storeStr = '{}';
  }
  try {
    this.data = JSON.parse(storeStr);
  } catch (e) {
    console.log('Error when parsing', storeFile, ':', e);
    this.data = {};
  }
}

CertificateStore.prototype.save = function save() {
  fs.writeFileSync(this.storeFile, JSON.stringify(this.data, null, '  '));
};

CertificateStore.prototype.add = function add(targetURL, certificate) {
  this.data[getHost(targetURL)] = comparableCertificate(certificate);
};

CertificateStore.prototype.isExisting = function isExisting(targetURL) {
  return this.data.hasOwnProperty(getHost(targetURL));
};

CertificateStore.prototype.isTrusted = function isTrusted(targetURL, certificate) {
  const host = getHost(targetURL);
  if (!this.isExisting(targetURL)) {
    return false;
  }
  return areEqual(this.data[host], comparableCertificate(certificate));
};

export default {
  load(storeFile) {
    return new CertificateStore(storeFile);
  },
};
