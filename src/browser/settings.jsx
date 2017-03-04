'use strict';

window.eval = global.eval = () => {
  throw new Error('Sorry, Mattermost does not support window.eval() for security reasons.');
};

const {remote} = require('electron');

const React = require('react');
const ReactDOM = require('react-dom');
const SettingsPage = require('./components/SettingsPage.jsx');

const configFile = remote.app.getPath('userData') + '/config.json';

require('electron-context-menu')({
  window: remote.getCurrentWindow()
});

ReactDOM.render(
  <SettingsPage configFile={configFile}/>,
  document.getElementById('content')
);

// Deny drag&drop navigation in mainWindow.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
