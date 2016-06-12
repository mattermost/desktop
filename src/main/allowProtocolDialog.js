'use strict';

const {
  app,
  dialog,
  ipcMain,
  shell
} = require('electron');
const path = require('path');
const fs = require('fs');

const allowedProtocolFile = path.resolve(app.getPath('userData'), 'allowedProtocols.json')
var allowedProtocols = [];

function init(mainWindow) {
  fs.readFile(allowedProtocolFile, 'utf-8', (err, data) => {
    if (!err) {
      allowedProtocols = JSON.parse(data);
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
        'No'
      ],
      cancelId: 2,
      noLink: true
    }, (response) => {
      switch (response) {
        case 1:
          allowedProtocols.push(protocol);
          fs.writeFile(allowedProtocolFile, JSON.stringify(allowedProtocols), (err) => {
            if (err) console.error(err);
          });
          // fallthrough
        case 0:
          shell.openExternal(URL);
          break;
        default:
          break;
      }
    });
  });
}

module.exports = {
  init: init
};
