// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/downloads';

import {CheckCircleIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';

import {getIconClassName, isImageFile} from 'renderer/utils';

type OwnProps = {
    item: DownloadedItem;
}

const iconSize = 12;
const colorGreen = '#3DB887';
const colorRed = '#D24B4E';

const isWin = window.process.platform === 'win32';

const Thumbnail = ({item}: OwnProps) => {
    const showBadge = (state: DownloadedItem['state']) => {
        switch (state) {
        case 'completed':
            return (
                <CheckCircleIcon
                    size={iconSize}
                    color={colorGreen}
                />
            );
        case 'progressing':
            return null;
        case 'available':
            return null;
        default:
            return (
                <CloseCircleIcon
                    size={iconSize}
                    color={colorRed}
                />
            );
        }
    };

    const showImagePreview = isImageFile(item) && item.state === 'completed';

    return (
        <div className='DownloadsDropdown__Thumbnail__Container'>
            {showImagePreview ?
                <div
                    className='DownloadsDropdown__Thumbnail preview'
                    style={{
                        backgroundImage: `url("${isWin ? `file:///${item.location.replaceAll('\\', '/')}` : item.location}")`,
                        backgroundSize: 'cover',
                    }}
                /> :
                <div className={`DownloadsDropdown__Thumbnail ${getIconClassName(item)}`}/>}
            {showBadge(item.state)}
        </div>
    );
};

export default Thumbnail;
