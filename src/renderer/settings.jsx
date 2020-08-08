// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import {remote, ipcRenderer} from 'electron';

import 'bootstrap/dist/css/bootstrap.min.css';
// eslint-disable-next-line import/no-unresolved
import 'renderer/css/settings.css';

// TODO: enable again, but for the moment seems to conflict with electron-webpack
// window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
//   import 'bootstrap/dist/css/bootstrap.min.css';
//     throw new Error(`Sorry, ${remote.app.name} does not support window.eval() for security reasons.`);
//   // eslint-disable-next-line import/no-unresolved
//   };

import React from 'react';
import ReactDOM from 'react-dom';

import Config from '../common/config';

import SettingsPage from './components/SettingsPage.jsx';

const config = new Config(remote.app.getPath('userData') + '/config.json', remote.getCurrentWindow().registryConfigData);

function getDarkMode() {
  if (process.platform !== 'darwin') {
    return config.darkMode;
  }
  return null;
}

function setDarkMode() {
  if (process.platform !== 'darwin') {
    const darkMode = Boolean(config.darkMode);
    config.set('darkMode', !darkMode);
    return !darkMode;
  }
  return null;
}

function openMenu() {
  if (process.platform !== 'darwin') {
    ipcRenderer.send('open-app-menu');
  }
}

ReactDOM.render(
  <SettingsPage
    getDarkMode={getDarkMode}
    setDarkMode={setDarkMode}
    openMenu={openMenu}
  />,
  document.getElementById('app')
);

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
