// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {DownloadedItem} from 'types/downloads';

import {CheckCircleIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';

import {getIconClassName, isImageFile} from 'renderer/utils';

type OwnProps = {
    item: DownloadedItem;
}

const iconSize = 14;
const colorGreen = '#3DB887';
const colorRed = '#D24B4E';

const isWin = window.process.platform === 'win32';

const Thumbnail = ({item}: OwnProps) => {
    const [imageUrl, setImageUrl] = useState<string | undefined>();

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

    useEffect(() => {
        const fetchThumbnail = async () => {
            const imageUrl = await window.mas.getThumbnailLocation(item.location);
            setImageUrl(imageUrl);
        };

        fetchThumbnail();
    }, [item]);

    const showImagePreview = isImageFile(item) && item.state === 'completed';
    if (showImagePreview && !imageUrl) {
        return null;
    }

    return (
        <div className='DownloadsDropdown__Thumbnail__Container'>
            {showImagePreview && imageUrl ?
                <div
                    className='DownloadsDropdown__Thumbnail preview'
                    style={{
                        backgroundImage: `url("${isWin ? `file:///${imageUrl.replaceAll('\\', '/')}` : imageUrl}")`,
                        backgroundSize: 'cover',
                    }}
                /> :
                <div className={`DownloadsDropdown__Thumbnail ${getIconClassName(item)}`}/>}
            {showBadge(item.state)}
        </div>
    );
};

export default Thumbnail;
