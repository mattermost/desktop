// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { FormattedMessage } from 'react-intl';

import IntlProvider from './intl_provider';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';
import {TAB_BAR_HEIGHT} from 'common/utils/constants';
import {DownloadItem, DownloadItems} from 'types/config';

import './css/downloadsDropdown.scss';

type State = {
    downloads?: DownloadItems;
    orderedDownloads?: DownloadItems;
    darkMode?: boolean;
    windowBounds?: Electron.Rectangle;
}

class DownloadsDropdown extends React.PureComponent<Record<string, never>, State> {
    constructor(props: Record<string, never>) {
        super(props);
        
        this.state = {
            downloads: [],
            orderedDownloads: [],
        };

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
                    maxWidth: this.state.windowBounds ? (this.state.windowBounds.width) : undefined,
                }}
            >
                    <div className='DownloadsDropdown__header'>
                        <span className='DownloadsDropdown__Downloads'>
                            Downloads
                        </span>
                    </div>
                    {/* <hr className='DownloadsDropdown__divider'/>
                    {this.state.orderedDownloads?.map((downloadItem) => {
                        return (
                            <div>{JSON.stringify(downloadItem)}</div>
                        )
                    })} */}
            </div>
        );
    }
}

ReactDOM.render(
    <DownloadsDropdown />,
    document.getElementById('app'),
);
