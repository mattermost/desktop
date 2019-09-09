// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import path from 'path';
import fs from 'fs';

import {app, dialog, ipcMain, shell} from 'electron';

import * as Validator from './Validator';

const allowedProtocolFile = path.resolve(app.getPath('userData'), 'allowedProtocols.json');
let allowedProtocols = [];

function init(mainWindow) {
  fs.readFile(allowedProtocolFile, 'utf-8', (err, data) => {
    if (!err) {
      allowedProtocols = JSON.parse(data);
      allowedProtocols = Validator.validateAllowedProtocols(allowedProtocols) || [];
    }
    initDialogEvent(mainWindow);
  });
}

function initDialogEvent(mainWindow) {
  ipcMain.on('confirm-protocol', (event, protocol, URL) => {
    if (allowedProtocols.indexOf(protocol) !== -1) {
      shell.openExternal(URL);
      return;
    }
    dialog.showMessageBox(mainWindow, {
      title: 'Non http(s) protocol',
      message: `${protocol} link requires an external application.`,
      detail: `The requested link is ${URL} . Do you want to continue?`,
      type: 'warning',
      buttons: [
        'Yes',
        `Yes (Save ${protocol} as allowed)`,
        'No',
      ],
      cancelId: 2,
      noLink: true,
    }, (response) => {
      switch (response) {
      case 1: {
        allowedProtocols.push(protocol);
        function handleError(err) {
          if (err) {
            console.error(err);
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
  });
}

export default {
  init,
};
