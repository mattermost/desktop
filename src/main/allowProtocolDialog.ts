// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {dialog, shell} from 'electron';
import log from 'electron-log';

import {t} from 'main/i18nManager';

import {protocols} from '../../electron-builder.json';

import * as Validator from './Validator';
import WindowManager from './windows/windowManager';
import {allowedProtocolFile} from './constants';

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
            protocols.forEach((protocol) => {
                if (protocol.schemes && protocol.schemes.length > 0) {
                    protocol.schemes.forEach(this.addScheme);
                }
            });
        });
    }

    addScheme = (scheme: string) => {
        const proto = `${scheme}:`;
        if (!this.allowedProtocols.includes(proto)) {
            this.allowedProtocols.push(proto);
        }
    }

    handleDialogEvent = (protocol: string, URL: string) => {
        if (this.allowedProtocols.indexOf(protocol) !== -1) {
            shell.openExternal(URL);
            return;
        }
        const mainWindow = WindowManager.getMainWindow();
        if (!mainWindow) {
            return;
        }
        dialog.showMessageBox(mainWindow, {
            title: t('main.allowProtocolDialog.title', 'Non http(s) protocol'),
            message: t('main.allowProtocolDialog.message', '{protocol} link requires an external application.', {protocol}),
            detail: t('main.allowProtocolDialog.detail', 'The requested link is {URL}. Do you want to continue?', {URL}),
            defaultId: 2,
            type: 'warning',
            buttons: [
                t('label.yes', 'Yes'),
                t('main.allowProtocolDialog.button.saveProtocolAsAllowed', 'Yes (Save {protocol} as allowed)', {protocol}),
                t('label.no', 'No'),
            ],
            cancelId: 2,
            noLink: true,
        }).then(({response}) => {
            switch (response) {
            case 1: {
                this.allowedProtocols.push(protocol);
                function handleError(err: NodeJS.ErrnoException | null) {
                    if (err) {
                        log.error(err);
                    }
                }
                fs.writeFile(allowedProtocolFile, JSON.stringify(this.allowedProtocols), handleError);
                shell.openExternal(URL);
                break;
            }
            case 0:
                shell.openExternal(URL);
                break;
            default:
                break;
            }
        });
    }
}

const allowProtocolDialog = new AllowProtocolDialog();
export default allowProtocolDialog;
