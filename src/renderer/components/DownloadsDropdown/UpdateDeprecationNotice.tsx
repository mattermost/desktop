// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import Thumbnail from './Thumbnail';

type OwnProps = {
    item: DownloadedItem;
    appName: string;
}

const UpdateDeprecationNotice = ({item, appName}: OwnProps) => {
    const isWindows = item.filename === 'win32';
    const isLinux = item.filename === 'linux';

    const onDismiss = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e?.preventDefault?.();
        window.desktop.downloadsDropdown.dismissUpdateDeprecationNotice();
    };

    return (
        <div className='DownloadsDropdown__Update'>
            <Thumbnail item={item}/>
            <div className='DownloadsDropdown__Update__Details'>
                <div className='DownloadsDropdown__Update__Details__Title'>
                    <FormattedMessage
                        id='renderer.downloadsDropdown.UpdateDeprecation.Title'
                        defaultMessage='Auto-updates are changing'
                    />
                </div>
                <div className='DownloadsDropdown__Update__Details__Description'>
                    {isWindows && (
                        <FormattedMessage
                            id='renderer.downloadsDropdown.UpdateDeprecation.Windows'
                            defaultMessage='Starting in version 6.1, this app will no longer support in-app automatic updates. Your app will continue to work, but you’ll need to install the application from the Windows Store to keep receiving updates.'
                            values={{appName}}
                        />
                    )}
                    {isLinux && (
                        <FormattedMessage
                            id='renderer.downloadsDropdown.UpdateDeprecation.Linux'
                            defaultMessage='Starting in version 6.1, this app will no longer support in-app automatic updates. Your app will continue to work, but you’ll need to install the application from our website, or use a package manager to keep receiving updates.'
                            values={{appName}}
                        />
                    )}
                </div>
                {isWindows && (
                    <button
                        id='openWindowsStoreButton'
                        className='primary-button DownloadsDropdown__Update__Details__Button'
                        onClick={() => window.desktop.downloadsDropdown.openWindowsStore()}
                    >
                        <FormattedMessage
                            id='renderer.downloadsDropdown.UpdateDeprecation.WindowsStoreLink'
                            defaultMessage='Open Windows Store'
                        />
                    </button>
                )}
                {isLinux && (
                    <button
                        id='openWebsiteButton'
                        className='primary-button DownloadsDropdown__Update__Details__Button'
                        onClick={() => window.desktop.downloadsDropdown.openWebsite()}
                    >
                        <FormattedMessage
                            id='renderer.downloadsDropdown.UpdateDeprecation.WebsiteLink'
                            defaultMessage='Learn more'
                        />
                    </button>
                )}
                <a
                    className='DownloadsDropdown__Update__Details__Changelog'
                    onClick={onDismiss}
                    href='#'
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdown.UpdateDeprecation.Dismiss'
                        defaultMessage='Dismiss'
                    />
                </a>
            </div>
        </div>
    );
};

export default UpdateDeprecationNotice;
