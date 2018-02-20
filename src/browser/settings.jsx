'use strict';
const {remote} = require('electron');

window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
  throw new Error(`Sorry, ${remote.app.getName()} does not support window.eval() for security reasons.`);
};

const React = require('react');
const ReactDOM = require('react-dom');

const buildConfig = require('../common/config/buildConfig');

const SettingsPage = require('./components/SettingsPage.jsx');
const contextMenu = require('./js/contextMenu');

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
