// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

import url from 'url';

import React from 'react';
import ReactDOM from 'react-dom';
import propTypes from 'prop-types';
import {remote} from 'electron';

import UpdaterPage from './components/UpdaterPage.jsx';

const thisURL = url.parse(location.href, true);
const notifyOnly = thisURL.query.notifyOnly === 'true';

class UpdaterPageContainer extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = props.initialState;
    }

    getTabWebContents() {
        return remote.webContents.getFocusedWebContents();
    }

    componentDidMount() {
        window.ipcRenderer.on('start-download', () => {
            this.setState({
                isDownloading: true,
            });
        });
        window.ipcRenderer.on('progress', (event, progress) => {
            this.setState({
                progress,
            });
        });
        window.ipcRenderer.on('zoom-in', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            if (activeTabWebContents.zoomLevel >= 9) {
                return;
            }
            activeTabWebContents.zoomLevel += 1;
        });

        window.ipcRenderer.on('zoom-out', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            if (activeTabWebContents.zoomLevel <= -8) {
                return;
            }
            activeTabWebContents.zoomLevel -= 1;
        });

        window.ipcRenderer.on('zoom-reset', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            activeTabWebContents.zoomLevel = 0;
        });

        window.ipcRenderer.on('undo', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            activeTabWebContents.undo();
        });

        window.ipcRenderer.on('redo', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            activeTabWebContents.redo();
        });

        window.ipcRenderer.on('cut', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            activeTabWebContents.cut();
        });

        window.ipcRenderer.on('copy', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            activeTabWebContents.copy();
        });

        window.ipcRenderer.on('paste', () => {
            const activeTabWebContents = this.getTabWebContents();
            if (!activeTabWebContents) {
                return;
            }
            activeTabWebContents.paste();
        });

        window.ipcRenderer.on('paste-and-match', () => {
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
                    window.ipcRenderer.send('click-release-notes');
                }}
                onClickSkip={() => {
                    window.ipcRenderer.send('click-skip');
                }}
                onClickRemind={() => {
                    window.ipcRenderer.send('click-remind');
                }}
                onClickInstall={() => {
                    window.ipcRenderer.send('click-install');
                }}
                onClickDownload={() => {
                    window.ipcRenderer.send('click-download');
                }}
                onClickCancel={() => {
                    window.ipcRenderer.send('click-cancel');
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
    document.getElementById('content'),
);
