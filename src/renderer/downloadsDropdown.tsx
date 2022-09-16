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
    UPDATE_DOWNLOADS_DROPDOWN,
} from 'common/communication';

import IntlProvider from './intl_provider';
import DownloadsDropdownFile from './components/DownloadsDropdown/DownloadsDropdownFile';

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

    handleMessageEvent = (event: MessageEvent) => {
        if (event.data.type === UPDATE_DOWNLOADS_DROPDOWN) {
            const {downloads, darkMode, windowBounds, item} = event.data.data;
            const newDownloads = Object.values<DownloadedItem>(downloads);
            newDownloads.sort((a, b) => b.addedAt - a.addedAt);
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

    preventPropagation = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    }

    clearAll = () => {
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
                        {(this.state.downloads || []).map((downloadItem: DownloadedItem) => {
                            return (
                                <DownloadsDropdownFile
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
