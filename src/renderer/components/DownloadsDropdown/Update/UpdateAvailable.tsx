// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import ThreeDotButton from '../ThreeDotButton';
import Thumbnail from '../Thumbnail';

type OwnProps = {
    activeItem?: DownloadedItem;
    item: DownloadedItem;
    appName: string;
}

const UpdateAvailable = ({item, appName, activeItem}: OwnProps) => {
    const {formatMessage} = useIntl();
    const [threeDotButtonVisible, setThreeDotButtonVisible] = useState(false);
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
        } else if (platform === 'linux') {
            window.desktop.openLinuxGitHubRelease();
        }
    };

    const handleDownloadManually = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e?.preventDefault?.();
        window.desktop.downloadUpdateManually();
    };

    const handleViewInstallGuide = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e?.preventDefault?.();
        window.desktop.openUpdateGuide();
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
                    defaultMessage='Download update'
                />
            );
        }
        if (platform === 'linux') {
            return (
                <FormattedMessage
                    id='renderer.downloadsDropdown.Update.ViewDownloadOptions'
                    defaultMessage='View download options'
                />
            );
        }
        return (
            <FormattedMessage
                id='renderer.downloadsDropdown.Update.DownloadUpdate'
                defaultMessage='Download update'
            />
        );
    };

    return (
        <div
            className='DownloadsDropdown__Update'
            role='status'
            aria-live='polite'
            aria-atomic='true'
            onMouseEnter={() => setThreeDotButtonVisible(true)}
            onMouseLeave={() => setThreeDotButtonVisible(false)}
        >
            <Thumbnail item={item}/>
            <div className='DownloadsDropdown__Update__Details'>
                <div
                    className='DownloadsDropdown__Update__Details__Title'
                    id='update-available-title'
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdown.Update.NewDesktopVersionAvailable'
                        defaultMessage='New version available'
                    />
                </div>
                <div
                    className='DownloadsDropdown__Update__Details__Description'
                    id='update-available-description'
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdown.Update.ANewVersionIsAvailableToInstall'
                        defaultMessage='{appName} Desktop App version {version} is available to install.'
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
                    aria-labelledby='update-available-title downloadUpdateButton'
                    aria-describedby='update-available-description'
                >
                    {getMainButtonText()}
                </button>
                <div className='DownloadsDropdown__Update__Details__SubButtons'>
                    {platform === 'win32' && (
                        <a
                            className='DownloadsDropdown__Update__Details__SubButton'
                            onClick={handleDownloadManually}
                            href='#'
                            aria-label={formatMessage({id: 'renderer.downloadsDropdown.Update.DownloadManually', defaultMessage: 'Download installer'})}
                        >
                            <FormattedMessage
                                id='renderer.downloadsDropdown.Update.DownloadManually'
                                defaultMessage='Download installer'
                            />
                        </a>
                    )}
                    {platform === 'linux' && (
                        <a
                            className='DownloadsDropdown__Update__Details__SubButton'
                            onClick={handleViewInstallGuide}
                            href='#'
                            aria-label={formatMessage({id: 'renderer.downloadsDropdown.Update.ViewInstallGuide', defaultMessage: 'View install guide'})}
                        >
                            <FormattedMessage
                                id='renderer.downloadsDropdown.Update.ViewInstallGuide'
                                defaultMessage='View install guide'
                            />
                        </a>
                    )}
                </div>
            </div>
            <ThreeDotButton
                item={item}
                activeItem={activeItem}
                visible={threeDotButtonVisible}
            />
        </div>
    );
};

export default UpdateAvailable;
