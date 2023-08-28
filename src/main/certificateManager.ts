// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Certificate, WebContents, Event} from 'electron';

import {CertificateModalData} from 'types/certificate';

import {Logger} from 'common/log';

import modalManager from './views/modalManager';
import {getLocalURLString, getLocalPreload} from './utils';
import MainWindow from './windows/mainWindow';

const log = new Logger('CertificateManager');
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
        log.verbose('handleSelectCertificate', url, list);

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
        const mainWindow = MainWindow.get();
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
