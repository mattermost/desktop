'use strict';

const fs = require('fs');
const url = require('url');

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
  var host = getHost(targetURL);
  if (!this.isExisting(targetURL)) {
    return false;
  }
  return areEqual(this.data[host], comparableCertificate(certificate));
};

module.exports = {
  load(storeFile) {
    return new CertificateStore(storeFile);
  },
};
