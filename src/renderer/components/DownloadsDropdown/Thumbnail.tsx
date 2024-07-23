// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CheckCircleIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';

import {getIconClassName, isImageFile} from 'renderer/utils';

import type {DownloadedItem} from 'types/downloads';

type OwnProps = {
    item: DownloadedItem;
}

const iconSize = 14;
const colorGreen = '#3DB887';
const colorRed = '#D24B4E';

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
    if (showImagePreview && !item.thumbnailData) {
        return null;
    }

    return (
        <div className='DownloadsDropdown__Thumbnail__Container'>
            {showImagePreview && item.thumbnailData ?
                <div
                    className='DownloadsDropdown__Thumbnail preview'
                    style={{
                        backgroundImage: `url("${item.thumbnailData}")`,
                        backgroundSize: 'cover',
                    }}
                /> :
                <div className={`DownloadsDropdown__Thumbnail ${getIconClassName(item)}`}/>}
            {showBadge(item.state)}
        </div>
    );
};

export default Thumbnail;
