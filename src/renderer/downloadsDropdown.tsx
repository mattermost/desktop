// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

import type {DownloadedItem, DownloadedItems} from 'types/downloads';

import DownloadsDropdownItem from './components/DownloadsDropdown/DownloadsDropdownItem';
import IntlProvider from './intl_provider';
import setupDarkMode from './modals/darkMode';

import './css/downloadsDropdown.scss';

setupDarkMode();

type State = {
    downloads: DownloadedItem[];
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

    handleUpdate = (downloads: DownloadedItems, windowBounds: Electron.Rectangle, item?: DownloadedItem) => {
        const newDownloads = Object.values<DownloadedItem>(downloads);
        newDownloads.sort((a, b) => {
            // Show deprecation notice first
            if (a.type === 'update_deprecation') {
                return -1;
            } else if (b.type === 'update_deprecation') {
                return 1;
            }

            // Show App update second
            if (a.type === 'update') {
                return -1;
            } else if (b.type === 'update') {
                return 1;
            }
            return b?.addedAt - a?.addedAt;
        });
        this.setState({
            downloads: newDownloads,
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
        const nonClearableTypes = ['update', 'update_deprecation'];
        return this.state.downloads?.length > 0 &&
               this.state.downloads.every((item) => nonClearableTypes.includes(item.type));
    };

    render() {
        if (!this.state.appName) {
            return null;
        }

        return (
            <IntlProvider>
                <div className='DownloadsDropdown'>
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
