// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DownloadedItem} from 'types/downloads';

type OwnProps = {
    item: DownloadedItem;
}

const ProgressBar = ({item}: OwnProps) => {
    if (item.state !== 'progressing') {
        return null;
    }

    return (
        <div className='DownloadsDropdown__File__ProgressBarContainer'>
            <div
                className='DownloadsDropdown__File__ProgressBar'
                style={{width: `${Math.max(1, item.progress)}%`}}
            />
        </div>
    );
};

export default ProgressBar;
