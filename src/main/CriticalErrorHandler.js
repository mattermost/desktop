// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {spawn} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {app, dialog} from 'electron';

import log from 'electron-log';

const BUTTON_OK = 'OK';
const BUTTON_SHOW_DETAILS = 'Show Details';
const BUTTON_REOPEN = 'Reopen';

function createErrorReport(err) {
  return `Application: ${app.name} ${app.getVersion()}\n` +
         `Platform: ${os.type()} ${os.release()} ${os.arch()}\n` +
         `${err.stack}`;
}

function openDetachedExternal(url) {
  const spawnOption = {detached: true, stdio: 'ignore'};
  switch (process.platform) {
  case 'win32':
    return spawn('cmd', ['/C', 'start', url], spawnOption);
  case 'darwin':
    return spawn('open', [url], spawnOption);
  case 'linux':
    return spawn('xdg-open', [url], spawnOption);
  default:
    return null;
  }
}

export default class CriticalErrorHandler {
  constructor() {
    this.mainWindow = null;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  windowUnresponsiveHandler() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'warning',
      title: app.name,
      message: 'The window is no longer responsive.\nDo you wait until the window becomes responsive again?',
      buttons: ['No', 'Yes'],
      defaultId: 0,
    }).then(({response}) => {
      if (response === 0) {
        throw new Error('BrowserWindow \'unresponsive\' event has been emitted');
      }
    });
  }

  processUncaughtExceptionHandler(err) {
    const file = path.join(app.getPath('userData'), `uncaughtException-${Date.now()}.txt`);
    const report = createErrorReport(err);
    fs.writeFileSync(file, report.replace(new RegExp('\\n', 'g'), os.EOL));

    if (app.isReady()) {
      const buttons = [BUTTON_SHOW_DETAILS, BUTTON_OK, BUTTON_REOPEN];
      if (process.platform === 'darwin') {
        buttons.reverse();
      }
      const bindWindow = this.mainWindow && this.mainWindow.isVisible() ? this.mainWindow : null;
      dialog.showMessageBox(
        bindWindow,
        {
          type: 'error',
          title: app.name,
          message: `The ${app.name} app quit unexpectedly. Click "Show Details" to learn more or "Reopen" to open the application again.\n\nInternal error: ${err.message}`,
          buttons,
          defaultId: buttons.indexOf(BUTTON_REOPEN),
          noLink: true,
        }
      ).then(({response}) => {
        let child;
        switch (response) {
        case buttons.indexOf(BUTTON_SHOW_DETAILS):
          child = openDetachedExternal(file);
          if (child) {
            child.on(
              'error',
              (spawnError) => {
                console.log(spawnError);
              }
            );
            child.unref();
          }
          break;
        case buttons.indexOf(BUTTON_REOPEN):
          app.relaunch();
          break;
        }
        app.exit(-1);
      });
    } else {
      log.err(`Window wasn't ready to handle the error: ${err}\ntrace: ${err.stack}`);
      throw err;
    }
  }
}

