// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import {DownloadedItem} from 'types/downloads';

import {
    CLOSE_DOWNLOADS_DROPDOWN,
    REQUEST_CLEAR_DOWNLOADS_DROPDOWN,
    REQUEST_DOWNLOADS_DROPDOWN_INFO,
    SEND_DOWNLOADS_DROPDOWN_SIZE,
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

import IntlProvider from './intl_provider';
import DownloadsDropdownItem from './components/DownloadsDropdown/DownloadsDropdownItem';

import './css/downloadsDropdown.scss';

type State = {
    downloads: DownloadedItem[];
    darkMode?: boolean;
    windowBounds?: Electron.Rectangle;
    item?: DownloadedItem;
}

class DownloadsDropdown extends React.PureComponent<Record<string, never>, State> {
    constructor(props: Record<string, never>) {
        super(props);

        this.state = {
            downloads: [],
        };

        window.addEventListener('message', this.handleMessageEvent);
    }

    componentDidMount() {
        window.postMessage({type: REQUEST_DOWNLOADS_DROPDOWN_INFO}, window.location.href);
    }

    componentDidUpdate() {
        window.postMessage({type: SEND_DOWNLOADS_DROPDOWN_SIZE, data: {width: document.body.scrollWidth, height: document.body.scrollHeight}}, window.location.href);
    }

    handleMessageEvent = (event: MessageEvent) => {
        if (event.data.type === UPDATE_DOWNLOADS_DROPDOWN) {
            const {downloads, darkMode, windowBounds, item} = event.data.data;
            const newDownloads = Object.values<DownloadedItem>(downloads);
            newDownloads.sort((a, b) => {
                // Show App update first
                if (a.type === 'update') {
                    return -1;
                } else if (b.type === 'update') {
                    return 1;
                }
                return b.addedAt - a.addedAt;
            });
            this.setState({
                downloads: newDownloads,
                darkMode,
                windowBounds,
                item,
            });
        }
    }

    closeMenu = () => {
        window.postMessage({type: CLOSE_DOWNLOADS_DROPDOWN}, window.location.href);
    }

    clearAll = () => {
        window.postMessage({type: REQUEST_CLEAR_DOWNLOADS_DROPDOWN}, window.location.href);
    }

    render() {
        return (
            <IntlProvider>
                <div
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
                        {(this.state.downloads || []).map((downloadItem: DownloadedItem) => {
                            return (
                                <DownloadsDropdownItem
                                    item={downloadItem}
                                    key={downloadItem.filename}
                                    activeItem={this.state.item}
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
