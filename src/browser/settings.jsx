'use strict';

window.eval = global.eval = () => {
  throw new Error('Sorry, Mattermost does not support window.eval() for security reasons.');
};

const {remote} = require('electron');

const React = require('react');
const ReactDOM = require('react-dom');
const SettingsPage = require('./components/SettingsPage.jsx');

var configFile = remote.getGlobal('config-file');

require('electron-context-menu')({
  window: remote.getCurrentWindow()
});

ReactDOM.render(
  <SettingsPage configFile={configFile}/>,
  document.getElementById('content')
);
