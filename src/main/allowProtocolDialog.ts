// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import {dialog, shell} from 'electron';

import buildConfig from 'common/config/buildConfig';
import {Logger} from 'common/log';
import * as Validator from 'common/Validator';
import {localizeMessage} from 'main/i18nManager';

import {allowedProtocolFile} from './constants';
import MainWindow from './windows/mainWindow';

const log = new Logger('AllowProtocolDialog');

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
        if (!this.allowedProtocols.includes(proto)) {
            this.allowedProtocols.push(proto);
        }
    };

    handleDialogEvent = async (protocol: string, URL: string) => {
        try {
            if (this.allowedProtocols.indexOf(protocol) !== -1) {
                await shell.openExternal(URL);
                return;
            }
            const mainWindow = MainWindow.get();
            if (!mainWindow) {
                return;
            }
            const {response} = await dialog.showMessageBox(mainWindow, {
                title: localizeMessage('main.allowProtocolDialog.title', 'Non http(s) protocol'),
                message: localizeMessage('main.allowProtocolDialog.message', '{protocol} link requires an external application.', {protocol}),
                detail: localizeMessage('main.allowProtocolDialog.detail', 'The requested link is {URL}. Do you want to continue?', {URL}),
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
                await shell.openExternal(URL);
                break;
            }
            case 0:
                await shell.openExternal(URL);
                break;
            }
        } catch (error) {
            log.warn('Could not open external URL', error);
        }
    };
}

const allowProtocolDialog = new AllowProtocolDialog();
export default allowProtocolDialog;
