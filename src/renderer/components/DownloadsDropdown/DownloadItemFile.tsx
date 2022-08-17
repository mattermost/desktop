// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ConfigDownloadItem} from 'types/config';

import FilePreview from './FilePreview';
import ThreeDotButton from './ThreeDotButton';

type OwnProps = {
    item: ConfigDownloadItem;
}

const DownloadsDropdownItemFile = ({item}: OwnProps) => {
    return (
        <div className='DownloadsDropdown__Item__File'>
            <div className='DownloadsDropdown__Item__File__Body'>
                <FilePreview item={item}/>
                <div className='DownloadsDropdown__Item__File__Body_Details'>
                    {item.filename}
                </div>
                <ThreeDotButton item={item}/>
            </div>
            {item.status === 'downloading' && <div className='DownloadsDropdown__Item__File__ProgressBar'>
                {item.progress}
            </div>}
        </div>
    );
};

export default DownloadsDropdownItemFile;
