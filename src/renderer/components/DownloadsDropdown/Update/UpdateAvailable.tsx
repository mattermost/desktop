// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import LoadingWrapper from 'renderer/components/SaveButton/LoadingWrapper';

import type {DownloadedItem} from 'types/downloads';

import Thumbnail from '../Thumbnail';

type OwnProps = {
    item: DownloadedItem;
    appName: string;
}

const UpdateAvailable = ({item, appName}: OwnProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isProcessing) {
            return;
        }
        setIsProcessing(true);
        e?.preventDefault?.();
        window.desktop.downloadsDropdown.startUpdateDownload();
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
                    onClick={onButtonClick}
                    disabled={isProcessing}
                >
                    <LoadingWrapper
                        loading={isProcessing}
                        text={(
                            <FormattedMessage
                                id='renderer.downloadsDropdown.Update.Downloading'
                                defaultMessage='Downloading'
                            />
                        )}
                    >
                        <FormattedMessage
                            id='renderer.downloadsDropdown.Update.DownloadUpdate'
                            defaultMessage='Download Update'
                        />
                    </LoadingWrapper>
                </button>
                <a
                    className='DownloadsDropdown__Update__Details__Changelog'
                    onClick={() => window.desktop.openChangelogLink()}
                    href='#'
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdown.Update.ViewChangelog'
                        defaultMessage='View Changelog'
                    />
                </a>
            </div>
        </div>
    );
};

export default UpdateAvailable;
