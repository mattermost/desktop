// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import path from 'path';
import log from 'electron-log';

import * as WindowManager from './windows/windowManager';

import {addModal} from './views/modalManager';
import {getLocalURLString} from './utils';

const modalPreload = path.resolve(__dirname, '../../dist/modalPreload.js');
const html = getLocalURLString('certificateModal.html');

export class CertificateManager {
    constructor() {
        this.certificateRequestCallbackMap = new Map();
    }

    handleSelectCertificate = (event, webContents, url, list, callback) => {
        if (list.length > 1) {
            event.preventDefault(); // prevent the app from getting the first certificate available

            // store callback so it can be called with selected certificate
            this.certificateRequestCallbackMap.set(url, callback);
            this.popCertificateModal(url, list);
        } else {
            log.info(`There were ${list.length} candidate certificates. Skipping certificate selection`);
        }
    }

    popCertificateModal = (url, list) => {
        const modalPromise = addModal(`certificate-${url}`, html, modalPreload, {url, list}, WindowManager.getMainWindow());
        modalPromise.then((data) => {
            const {cert} = data;
            this.handleSelectedCertificate(url, cert);
        }).catch((err) => {
            if (err) {
                log.error('Error processing certificate selection', err);
            }
            this.handleSelectedCertificate(url);
        });
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
