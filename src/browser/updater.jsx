const React = require('react');
const ReactDOM = require('react-dom');
const {ipcRenderer} = require('electron');
const url = require('url');
const UpdaterPage = require('./components/UpdaterPage.jsx');

const thisURL = url.parse(location.href, true);
const notifyOnly = thisURL.query.notifyOnly === 'true';

ReactDOM.render(
  <UpdaterPage
    notifyOnly={notifyOnly}
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
    onClickDownload={() => {
      ipcRenderer.send('click-download');
    }}
  />,
  document.getElementById('content')
);
