// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import path from 'path';

import {app, dialog, shell} from 'electron';
import log from 'electron-log';

import {protocols} from '../../electron-builder.json';

import * as Validator from './Validator';
import {getMainWindow} from './windows/windowManager';

const allowedProtocolFile = path.resolve(app.getPath('userData'), 'allowedProtocols.json');
let allowedProtocols = [];

function addScheme(scheme) {
    const proto = `${scheme}:`;
    if (!allowedProtocols.includes(proto)) {
        allowedProtocols.push(proto);
    }
}

function init() {
    fs.readFile(allowedProtocolFile, 'utf-8', (err, data) => {
        if (!err) {
            allowedProtocols = JSON.parse(data);
            allowedProtocols = Validator.validateAllowedProtocols(allowedProtocols) || [];
        }
        addScheme('http');
        addScheme('https');
        protocols.forEach((protocol) => {
            if (protocol.schemes && protocol.schemes.length > 0) {
                protocol.schemes.forEach(addScheme);
            }
        });
    });
}

function handleDialogEvent(protocol, URL) {
    if (allowedProtocols.indexOf(protocol) !== -1) {
        shell.openExternal(URL);
        return;
    }
    dialog.showMessageBox(getMainWindow(), {
        title: 'Non http(s) protocol',
        message: `${protocol} link requires an external application.`,
        detail: `The requested link is ${URL} . Do you want to continue?`,
        defaultId: 2,
        type: 'warning',
        buttons: [
            'Yes',
            `Yes (Save ${protocol} as allowed)`,
            'No',
        ],
        cancelId: 2,
        noLink: true,
    }).then(({response}) => {
        switch (response) {
        case 1: {
            allowedProtocols.push(protocol);
            function handleError(err) {
                if (err) {
                    log.error(err);
                }
            }
            fs.writeFile(allowedProtocolFile, JSON.stringify(allowedProtocols), handleError);
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

export default {
    init,
    handleDialogEvent,
};
