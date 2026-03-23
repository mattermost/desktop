// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {dialog, shell} from 'electron';

import buildConfig from 'common/config/buildConfig';
import {Logger} from 'common/log';
import * as Validator from 'common/Validator';
import {localizeMessage} from 'main/i18nManager';

import MainWindow from '../../app/mainWindow/mainWindow';
import {allowedProtocolFile} from '../constants';

const log = new Logger('AllowProtocolDialog');

// Protocols that must never be opened via shell.openExternal regardless of user choice.
// These are known attack vectors for remote code execution or local file access.
const BLOCKED_PROTOCOLS = new Set([
    'file:',
    // eslint-disable-next-line no-script-url
    'javascript:',
    'data:',
    'vbscript:',
    'ms-msdt:', // CVE-2021-34527 / Follina — MSDT remote code execution
    'search-ms:', // Windows Search protocol — can be abused for UNC path injection
    'ms-appinstaller:', // CVE-2021-43890 — App Installer malware distribution vector
    'ms-officecmd:', // Office command handler — can trigger macro execution
]);

export class AllowProtocolDialog {
    allowedProtocols: string[];

    constructor() {
        this.allowedProtocols = [];
    }

    init = () => {
        fs.readFile(allowedProtocolFile, 'utf-8', (err, data) => {
            if (!err) {
                this.allowedProtocols = JSON.parse(data);
                this.allowedProtocols = Validator.validateAllowedProtocols(this.allowedProtocols) || [];
            }
            this.addScheme('http');
            this.addScheme('https');
            buildConfig.allowedProtocols.forEach(this.addScheme);
        });
    };

    addScheme = (scheme: string) => {
        const proto = `${scheme}:`;
        if (BLOCKED_PROTOCOLS.has(proto)) {
            log.warn(`Refusing to add blocked protocol to allowlist: ${proto}`);
            return;
        }
        if (!this.allowedProtocols.includes(proto)) {
            this.allowedProtocols.push(proto);
        }
    };

    handleDialogEvent = async (url: URL) => {
        const protocol = url.protocol;
        const serializedURL = url.toString();

        if (BLOCKED_PROTOCOLS.has(protocol)) {
            log.warn(`Blocked attempt to open dangerous protocol: ${protocol}`);
            return;
        }

        try {
            if (this.allowedProtocols.indexOf(protocol) !== -1) {
                await shell.openExternal(serializedURL);
                return;
            }
            const mainWindow = MainWindow.get();
            if (!mainWindow) {
                return;
            }
            const {response} = await dialog.showMessageBox(mainWindow, {
                title: localizeMessage('main.allowProtocolDialog.title', 'Non http(s) protocol'),
                message: localizeMessage('main.allowProtocolDialog.message', '{protocol} link requires an external application.', {protocol}),
                detail: localizeMessage('main.allowProtocolDialog.detail', 'The requested link is {URL}. Do you want to continue?', {URL: serializedURL}),
                defaultId: 2,
                type: 'warning',
                buttons: [
                    localizeMessage('label.yes', 'Yes'),
                    localizeMessage('main.allowProtocolDialog.button.saveProtocolAsAllowed', 'Yes (Save {protocol} as allowed)', {protocol}),
                    localizeMessage('label.no', 'No'),
                ],
                cancelId: 2,
                noLink: true,
            });

            switch (response) {
            case 1: {
                this.allowedProtocols.push(protocol);
                function handleError(err: NodeJS.ErrnoException | null) {
                    if (err) {
                        log.error(err);
                    }
                }
                fs.writeFile(allowedProtocolFile, JSON.stringify(this.allowedProtocols), handleError);
                await shell.openExternal(serializedURL);
                break;
            }
            case 0:
                await shell.openExternal(serializedURL);
                break;
            }
        } catch (error) {
            log.warn('Could not open external URL', {error});
        }
    };
}

const allowProtocolDialog = new AllowProtocolDialog();
export default allowProtocolDialog;
