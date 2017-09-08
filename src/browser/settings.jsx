'use strict';
const appName = require('../package.json').productName;

window.eval = global.eval = () => {
  throw new Error(`Sorry, ${appName} does not support window.eval() for security reasons.`);
};

const {remote} = require('electron');

const React = require('react');
const ReactDOM = require('react-dom');
const SettingsPage = require('./components/SettingsPage.jsx');
const contextMenu = require('./js/contextMenu');

const configFile = remote.app.getPath('userData') + '/config.json';

contextMenu.setup(remote.getCurrentWindow());

ReactDOM.render(
  <SettingsPage configFile={configFile}/>,
  document.getElementById('content')
);

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
