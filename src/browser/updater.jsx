const React = require('react');
const ReactDOM = require('react-dom');
const {ipcRenderer} = require('electron');
const UpdaterPage = require('./components/UpdaterPage.jsx');

ReactDOM.render(
  <UpdaterPage
    onClickReleaseNotes={() => {
      ipcRenderer.send('click-release-notes');
    }}
    onClickSkip={() => {
      ipcRenderer.send('click-skip');
    }}
    onClickRemind={() => {
      ipcRenderer.send('click-remind');
    }}
    onClickInstall={() => {
      ipcRenderer.send('click-install');
    }}
  />,
  document.getElementById('content')
);
