'use strict';

const fs = require('fs');
const url = require('url');

function comparableCertificate(certificate) {
  return {
    data: certificate.data.toString(),
    issuerName: certificate.issuerName
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

var CertificateStore = function(storeFile) {
  this.storeFile = storeFile
  try {
    this.data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
  }
  catch (e) {
    console.log(e);
    this.data = {};
  }
};

CertificateStore.prototype.save = function() {
  fs.writeFileSync(this.storeFile, JSON.stringify(this.data, null, '  '));
};

CertificateStore.prototype.add = function(targetURL, certificate) {
  this.data[getHost(targetURL)] = comparableCertificate(certificate);
};

CertificateStore.prototype.isExisting = function(targetURL) {
  return this.data.hasOwnProperty(getHost(targetURL));
};

CertificateStore.prototype.isTrusted = function(targetURL, certificate) {
  var host = getHost(targetURL);
  if (!this.isExisting(targetURL)) {
    return false;
  }
  return areEqual(this.data[host], comparableCertificate(certificate));
};

module.exports = {
  load: function(storeFile) {
    return new CertificateStore(storeFile);
  }
};
