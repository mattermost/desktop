// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BrowserWindow} from 'electron';
import log from 'electron-log';

import {getLocalURLString} from '../utils';

export function createSettingsWindow(mainWindow, config, withDevTools) {
  const spellcheck = (typeof config.useSpellChecker === 'undefined' ? true : config.useSpellChecker);
  const settingsWindow = new BrowserWindow({...config.data, parent: mainWindow, title: 'Desktop App Settings', webPreferences: {nodeIntegration: true, spellcheck}});
  const localURL = getLocalURLString('settings.html');
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