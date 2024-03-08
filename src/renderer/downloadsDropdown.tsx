// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

import type {DownloadedItem, DownloadedItems} from 'types/downloads';

import DownloadsDropdownItem from './components/DownloadsDropdown/DownloadsDropdownItem';
import IntlProvider from './intl_provider';

import './css/downloadsDropdown.scss';

type State = {
    downloads: DownloadedItem[];
    darkMode?: boolean;
    windowBounds?: Electron.Rectangle;
    item?: DownloadedItem;
    appName?: string;
}

class DownloadsDropdown extends React.PureComponent<Record<string, never>, State> {
    constructor(props: Record<string, never>) {
        super(props);

        this.state = {
            downloads: [],
        };

        window.desktop.onUpdateDownloadsDropdown(this.handleUpdate);
    }

    componentDidMount() {
        window.addEventListener('click', () => {
            window.desktop.closeDownloadsDropdownMenu();
        });

        window.addEventListener('mousemove', () => {
            window.desktop.downloadsDropdown.focus();
        });

        window.desktop.getVersion().then(({name}) => {
            this.setState({appName: name});
        });
        window.desktop.downloadsDropdown.requestInfo();
    }

    componentDidUpdate() {
        window.desktop.downloadsDropdown.sendSize(document.body.scrollWidth, document.body.scrollHeight);
    }

    handleUpdate = (downloads: DownloadedItems, darkMode: boolean, windowBounds: Electron.Rectangle, item?: DownloadedItem) => {
        const newDownloads = Object.values<DownloadedItem>(downloads);
        newDownloads.sort((a, b) => {
            // Show App update first
            if (a.type === 'update') {
                return -1;
            } else if (b.type === 'update') {
                return 1;
            }
            return b?.addedAt - a?.addedAt;
        });
        this.setState({
            downloads: newDownloads,
            darkMode,
            windowBounds,
            item,
        });
    };

    closeMenu = () => {
        window.desktop.closeDownloadsDropdown();
    };

    clearAll = () => {
        if (!this.clearAllButtonDisabled()) {
            window.desktop.downloadsDropdown.requestClearDownloadsDropdown();
        }
    };

    clearAllButtonDisabled = () => {
        return this.state.downloads?.length === 1 && this.state.downloads[0]?.type === 'update';
    };

    render() {
        if (!this.state.appName) {
            return null;
        }

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
                            className={classNames('DownloadsDropdown__clearAllButton', {
                                disabled: this.clearAllButtonDisabled(),
                            })}
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
                                    appName={this.state.appName || ''}
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
