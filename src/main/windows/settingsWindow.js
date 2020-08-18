// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow} from 'electron';
import log from 'electron-log';

import {getLocalURL} from '../utils';

export function createSettingsWindow(mainWindow, config, withDevTools) {
  const settingsWindow = new BrowserWindow({...config.data, parent: mainWindow, title: 'Desktop App Settings', webPreferences: {nodeIntegration: true}});
  const localURL = getLocalURL('settings.html');
  settingsWindow.loadURL(localURL).catch(
    (reason) => {
      log.error(`Settings window failed to load: ${reason}`);
      log.info(process.env);
    });
  settingsWindow.show();

  if (withDevTools) {
    settingsWindow.webContents.openDevTools();
  }
  return settingsWindow;
}