// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import log from 'electron-log';

import * as WindowManager from './windows/windowManager';

import {addModal} from './modalManager';
import {getLocalURLString} from './utils';

const modalPreload = path.resolve(__dirname, '../../dist/modalPreload.js');

export class CertificateManager {
  constructor() {
    this.certificateQueue = [];
    this.certificateRequestCallbackMap = new Map();
  }

  handleSelectCertificate = (event, webContents, url, list, callback) => {
    if (list.length > 1) {
      event.preventDefault(); // prevent the app from getting the first certificate available

      // store callback so it can be called with selected certificate
      this.certificateRequestCallbackMap.set(url, callback);
      this.addToCertificateQueue(url, list);
    } else {
      log.info(`There were ${list.length} candidate certificates. Skipping certificate selection`);
    }
  }

  addToCertificateQueue = (url, list) => {
    this.certificateQueue.push({
      url,
      list
    });

    this.showCertificateModalIfNecessary();
  }

  showCertificateModalIfNecessary = () => {
    if (this.certificateQueue.length) {
      const {url, list} = this.certificateQueue[0];
      const html = getLocalURLString('certificateModal.html');

      const modalPromise = addModal('certificate', html, modalPreload, {url, list}, WindowManager.getMainWindow());
      if (modalPromise) {
        modalPromise.then((data) => {
          const {cert} = data;
          this.handleSelectedCertificate(url, cert);
          this.certificateQueue.shift();
          this.showCertificateModalIfNecessary();
        }).catch(() => {
          this.handleSelectedCertificate(url);
          this.certificateQueue.shift();
          this.showCertificateModalIfNecessary();
        });
      } else {
        console.warn('There is already a certificate modal');
      }
    }
  }

  handleSelectedCertificate = (server, cert) => {
    const callback = this.certificateRequestCallbackMap.get(server);
    if (!callback) {
      log.error(`there was no callback associated with: ${server}`);
      return;
    }
    if (typeof cert === 'undefined') {
      log.info('user canceled certificate selection');
    } else {
      try {
        callback(cert);
      } catch (e) {
        log.error(`There was a problem using the selected certificate: ${e}`);
      }
    }
  }
}
