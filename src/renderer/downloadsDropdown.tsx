// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

import {DownloadItem, DownloadItems} from 'types/config';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

import {TAB_BAR_HEIGHT, THREE_DOT_MENU_WIDTH_MAC} from 'common/utils/constants';

import './css/dropdown.scss';

type State = {
    downloads?: DownloadItems;
    orderedDownloads?: DownloadItems;
    darkMode?: boolean;
    windowBounds?: Electron.Rectangle;
}

class DownloadsDropdown extends React.PureComponent<Record<string, never>, State> {
    buttonRefs: Map<number, HTMLButtonElement>;

    constructor(props: Record<string, never>) {
        super(props);
        this.buttonRefs = new Map();
        window.addEventListener('message', this.handleMessageEvent);
    }

    handleMessageEvent = (event: MessageEvent) => {
        if (event.data.type === UPDATE_DOWNLOADS_DROPDOWN) {
            const {downloads, darkMode, windowBounds} = event.data.data;
            this.setState({
                downloads,
                orderedDownloads: downloads.concat().sort((a: DownloadItem, b: DownloadItem) => a.addedAt - b.addedAt),
                darkMode,
                windowBounds,
            });
        }
    }

    closeMenu = () => {
        window.postMessage({type: CLOSE_DOWNLOADS_DROPDOWN}, window.location.href);
    }

    preventPropagation = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    }

    componentDidMount() {
        window.postMessage({type: REQUEST_DOWNLOADS_DROPDOWN_INFO}, window.location.href);
    }

    render() {
        return (
            <div
                onClick={this.preventPropagation}
                className={classNames('DownloadsDropdown', {
                    darkMode: this.state.darkMode,
                })}
                style={{
                    maxHeight: this.state.windowBounds ? (this.state.windowBounds.height - TAB_BAR_HEIGHT - 16) : undefined,
                    maxWidth: this.state.windowBounds ? (this.state.windowBounds.width - THREE_DOT_MENU_WIDTH_MAC) : undefined,
                }}
            >
                <div className='DownloadsDropdown__header'>
                    <span className='DownloadsDropdown__servers'>{'Servers'}</span>
                    <span className='DownloadsDropdown__keyboardShortcut'>
                        {window.process.platform === 'darwin' ? '⌃⌘S' : 'Ctrl + Shift + S'}
                    </span>
                </div>
                <hr className='DownloadsDropdown__divider'/>
                    {this.state.orderedDownloads?.map((downloadItem) => {
                        return (
                            <div>{JSON.stringify(downloadItem)}</div>
                        )
                    })}
            </div>
        );
    }
}

ReactDOM.render(
    <DownloadsDropdown/>,
    document.getElementById('app'),
);
