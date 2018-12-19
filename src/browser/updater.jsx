// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import url from 'url';

import React from 'react';
import ReactDOM from 'react-dom';
import propTypes from 'prop-types';
import {ipcRenderer, remote} from 'electron';

import UpdaterPage from './components/UpdaterPage.jsx';

const thisURL = url.parse(location.href, true);
const notifyOnly = thisURL.query.notifyOnly === 'true';

class UpdaterPageContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = props.initialState;
  }

  componentDidMount() {
    ipcRenderer.on('start-download', () => {
      this.setState({
        isDownloading: true,
      });
    });
    ipcRenderer.on('progress', (event, progress) => {
      this.setState({
        progress,
      });
    });
  }

  render() {
    return (
      <UpdaterPage
        appName={`${remote.app.getName()} Desktop App`}
        notifyOnly={this.props.notifyOnly}
        {...this.state}
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
        onClickCancel={() => {
          ipcRenderer.send('click-cancel');
        }}
      />
    );
  }
}

UpdaterPageContainer.propTypes = {
  notifyOnly: propTypes.bool,
  initialState: propTypes.object,
};

ReactDOM.render(
  <UpdaterPageContainer
    notifyOnly={notifyOnly}
    initialState={{isDownloading: false, progress: 0}}
  />,
  document.getElementById('content')
);
