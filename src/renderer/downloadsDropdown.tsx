// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import {ConfigDownloadItem, DownloadItems} from 'types/config';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    REQUEST_CLEAR_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

import IntlProvider from './intl_provider';

import './css/downloadsDropdown.scss';
import DownloadsDropdownItemFile from './components/DownloadsDropdown/DownloadItemFile';

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

    componentDidMount() {
        window.postMessage({type: REQUEST_DOWNLOADS_DROPDOWN_INFO}, window.location.href);
    }

    handleMessageEvent = (event: MessageEvent) => {
        if (event.data.type === UPDATE_DOWNLOADS_DROPDOWN) {
            const {downloads, darkMode, windowBounds} = event.data.data;
            this.setState({
                downloads,
                orderedDownloads: downloads.concat().sort((a: ConfigDownloadItem, b: ConfigDownloadItem) => a.addedAt - b.addedAt),
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

    clearAll = () => {
        this.setState({
            downloads: [],
            orderedDownloads: [],
        });
        window.postMessage({type: REQUEST_CLEAR_DOWNLOADS_DROPDOWN}, window.location.href);
    }

    render() {
        return (
            <IntlProvider>
                <div
                    onClick={this.preventPropagation}
                    className={classNames('DownloadsDropdown', {
                        darkMode: this.state.darkMode,
                    })}
                >
                    <div className='DownloadsDropdown__header'>
                        <div className='DownloadsDropdown__Downloads'>
                            <FormattedMessage
                                id='renderer.downloadsDropdown.Downloads'
                                defaultMessage='Downloads'
                            />
                        </div>
                        <div
                            className={'DownloadsDropdown__clearAllButton'}
                            onClick={this.clearAll}
                        >
                            <FormattedMessage
                                id='renderer.downloadsDropdown.ClearAll'
                                defaultMessage='Clear All'
                            />
                        </div>
                    </div>
                    <hr className='DownloadsDropdown__divider'/>
                    <div className='DownloadsDropdown__list'>
                        {this.state.orderedDownloads?.map((downloadItem: ConfigDownloadItem) => {
                            return (
                                <DownloadsDropdownItemFile
                                    item={downloadItem}
                                    key={downloadItem.addedAt}
                                />
                            );
                        })}
                    </div>
                </div>
            </IntlProvider>
        );
    }
}

ReactDOM.render(
    <DownloadsDropdown/>,
    document.getElementById('app'),
);
