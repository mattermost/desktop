// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import {ipcRenderer} from 'electron';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'renderer/css/index.css';
import 'renderer/css/settings.css';

// TODO: enable again, but for the moment seems to conflict with electron-webpack
// window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
//   import 'bootstrap/dist/css/bootstrap.min.css';
//     throw new Error(`Sorry, ${remote.app.name} does not support window.eval() for security reasons.`);
//   };

import React from 'react';
import ReactDOM from 'react-dom';

import {GET_CONFIGURATION} from 'common/communication';

import SettingsPage from './components/SettingsPage.jsx';

let config;

const start = async () => {
  config = await ipcRenderer.invoke(GET_CONFIGURATION);
  ReactDOM.render(
    <SettingsPage
      getDarkMode={getDarkMode}
      setDarkMode={setDarkMode}
      openMenu={openMenu}
    />,
    document.getElementById('app')
  );
};

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

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());

start();