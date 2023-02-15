// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import log from 'electron-log';
import {Certificate, WebContents} from 'electron';

import {CertificateModalData} from 'types/certificate';

import WindowManager from './windows/windowManager';

import modalManager from './views/modalManager';
import {getLocalURLString, getLocalPreload} from './utils';

const preload = getLocalPreload('desktopAPI.js');
const html = getLocalURLString('certificateModal.html');

type CertificateModalResult = {
    cert: Certificate;
}

export class CertificateManager {
    certificateRequestCallbackMap: Map<string, (certificate?: Certificate | undefined) => void>;

    constructor() {
        this.certificateRequestCallbackMap = new Map();
    }

    handleSelectCertificate = (event: Event, webContents: WebContents, url: string, list: Certificate[], callback: (certificate?: Certificate | undefined) => void) => {
        log.verbose('CertificateManager.handleSelectCertificate', url, list);

        if (list.length > 1) {
            event.preventDefault(); // prevent the app from getting the first certificate available

            // store callback so it can be called with selected certificate
            this.certificateRequestCallbackMap.set(url, callback);
            this.popCertificateModal(url, list);
        } else {
            log.info(`There were ${list.length} candidate certificates. Skipping certificate selection`);
        }
    }

    popCertificateModal = (url: string, list: Certificate[]) => {
        const mainWindow = WindowManager.getMainWindow();
        if (!mainWindow) {
            return;
        }
        const modalPromise = modalManager.addModal<CertificateModalData, CertificateModalResult>(`certificate-${url}`, html, preload, {url, list}, mainWindow);
        if (modalPromise) {
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
    }

    handleSelectedCertificate = (server: string, cert?: Certificate) => {
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
        this.certificateRequestCallbackMap.delete(server);
    }
}

const certificateManager = new CertificateManager();
export default certificateManager;
