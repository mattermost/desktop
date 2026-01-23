// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import Thumbnail from '../Thumbnail';

type OwnProps = {
    item: DownloadedItem;
    appName: string;
}

const UpdateAvailable = ({item, appName}: OwnProps) => {
    const [isMacAppStore, setIsMacAppStore] = useState(false);
    const platform = window.process.platform;

    useEffect(() => {
        if (platform === 'darwin') {
            window.desktop.getIsMacAppStore().then(setIsMacAppStore);
        }
    }, [platform]);

    const handleMainButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault?.();

        if (platform === 'win32') {
            window.desktop.openWindowsStore();
        } else if (platform === 'darwin') {
            if (isMacAppStore) {
                window.desktop.openMacAppStore();
            } else {
                window.desktop.downloadUpdateManually();
            }
            window.desktop.downloadUpdateManually();
        } else if (platform === 'linux') {
            window.desktop.openUpdateGuide();
        }
    };

    const handleDownloadManually = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e?.preventDefault?.();
        window.desktop.downloadUpdateManually();
    };

    const handleViewChangelog = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e?.preventDefault?.();
        window.desktop.openChangelogLink();
    };

    const getMainButtonText = () => {
        if (platform === 'win32') {
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdown.Update.OpenWindowsStore'
                    defaultMessage='Open Windows Store'
                />
            );
        }
        if (platform === 'darwin') {
            if (isMacAppStore) {
                return (
                    <FormattedMessage
                        id='renderer.downloadsDropdown.Update.OpenMacAppStore'
                        defaultMessage='Open Mac App Store'
                    />
                );
            }
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdown.Update.DownloadUpdate'
                    defaultMessage='Download Update'
                />
            );
        }
        if (platform === 'linux') {
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdown.Update.ViewUpdateGuide'
                    defaultMessage='View Update Guide'
                />
            );
        }
        return (
            <FormattedMessage
                id='renderer.downloadsDropdown.Update.DownloadUpdate'
                defaultMessage='Download Update'
            />
        );
    };

    return (
        <div className='DownloadsDropdown__Update'>
            <Thumbnail item={item}/>
            <div className='DownloadsDropdown__Update__Details'>
                <div className='DownloadsDropdown__Update__Details__Title'>
                    <FormattedMessage
                        id='renderer.downloadsDropdown.Update.NewDesktopVersionAvailable'
                        defaultMessage='New Desktop version available'
                    />
                </div>
                <div className='DownloadsDropdown__Update__Details__Description'>
                    <FormattedMessage
                        id='renderer.downloadsDropdown.Update.ANewVersionIsAvailableToInstall'
                        defaultMessage={`A new version of the {appName} Desktop App (version ${item.filename}) is available to install.`}
                        values={{
                            version: item.filename,
                            appName,
                        }}
                    />
                </div>
                <button
                    id='downloadUpdateButton'
                    className='primary-button DownloadsDropdown__Update__Details__Button'
                    onClick={handleMainButtonClick}
                >
                    {getMainButtonText()}
                </button>
                <div className='DownloadsDropdown__Update__Details__SubButtons'>
                    {(platform === 'win32' || platform === 'darwin') && (
                        <a
                            className='DownloadsDropdown__Update__Details__SubButton'
                            onClick={handleDownloadManually}
                            href='#'
                        >
                            <FormattedMessage
                                id='renderer.downloadsDropdown.Update.DownloadManually'
                                defaultMessage='Download Manually'
                            />
                        </a>
                    )}
                    <a
                        className='DownloadsDropdown__Update__Details__SubButton'
                        onClick={handleViewChangelog}
                        href='#'
                    >
                        <FormattedMessage
                            id='renderer.downloadsDropdown.Update.ViewChangelog'
                            defaultMessage='View Changelog'
                        />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default UpdateAvailable;
