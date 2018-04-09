'use strict';
import {remote} from 'electron';

window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
  throw new Error(`Sorry, ${remote.app.getName()} does not support window.eval() for security reasons.`);
};

import React from 'react';
import ReactDOM from 'react-dom';

import buildConfig from '../common/config/buildConfig';

import SettingsPage from './components/SettingsPage.jsx';
import contextMenu from './js/contextMenu';

const configFile = remote.app.getPath('userData') + '/config.json';

contextMenu.setup(remote.getCurrentWindow());

ReactDOM.render(
  <SettingsPage
    configFile={configFile}
    enableServerManagement={buildConfig.enableServerManagement}
  />,
  document.getElementById('content')
);

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
