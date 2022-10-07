// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/downloads';

import {FormattedMessage} from 'react-intl';

import {Button} from 'react-bootstrap';

import {START_UPDATE_DOWNLOAD} from 'common/communication';

import Thumbnail from '../Thumbnail';

type OwnProps = {
    item: DownloadedItem;
}

const UpdateAvailable = ({item}: OwnProps) => {
    const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault?.();
        window.postMessage({type: START_UPDATE_DOWNLOAD}, window.location.href);
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
                        defaultMessage={`A new version of the Mattermost Desktop App (version ${item.filename}) is available to install.`}
                        values={{version: item.filename}}
                    />
                </div>
                <Button
                    id='downloadUpdateButton'
                    className='primary-button'
                    onClick={onButtonClick}
                >
                    <FormattedMessage
                        id='renderer.downloadsDropdown.Update.DownloadUpdate'
                        defaultMessage='Download Update'
                    />
                </Button>
            </div>
        </div>
    );
};

export default UpdateAvailable;
