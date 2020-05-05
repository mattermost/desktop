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

  getTabWebContents() {
    return remote.webContents.getFocusedWebContents();
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
    ipcRenderer.on('zoom-in', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.zoomLevel >= 9) {
        return;
      }
      activeTabWebContents.zoomLevel += 1;
    });

    ipcRenderer.on('zoom-out', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.zoomLevel <= -8) {
        return;
      }
      activeTabWebContents.zoomLevel -= 1;
    });

    ipcRenderer.on('zoom-reset', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.zoomLevel = 0;
    });

    ipcRenderer.on('undo', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.undo();
    });

    ipcRenderer.on('redo', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.redo();
    });

    ipcRenderer.on('cut', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.cut();
    });

    ipcRenderer.on('copy', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.copy();
    });

    ipcRenderer.on('paste', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.paste();
    });

    ipcRenderer.on('paste-and-match', () => {
      const activeTabWebContents = this.getTabWebContents();
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.pasteAndMatchStyle();
    });
  }

  render() {
    return (
      <UpdaterPage
        appName={`${remote.app.name} Desktop App`}
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
