// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/config';

import {CheckCircleIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';

import {getIconClassName} from 'renderer/utils';

type OwnProps = {
    item: DownloadedItem;
}

const iconSize = 12;
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
        default:
            return (
                <CloseCircleIcon
                    size={iconSize}
                    color={colorRed}
                />
            );
        }
    };

    return (
        <div className='DownloadsDropdown__File__Body__Thumbnail__Container'>
            <div className={`DownloadsDropdown__File__Body__Thumbnail ${getIconClassName(item)}`}/>
            {showBadge(item.state)}
        </div>
    );
};

export default Thumbnail;
