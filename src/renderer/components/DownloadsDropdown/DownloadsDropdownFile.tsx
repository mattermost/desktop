// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ConfigDownloadItem} from 'types/config';

import FileSizeAndStatus from './FileSizeAndStatus';
import ThreeDotButton from './ThreeDotButton';
import Thumbnail from './Thumbnail';

type OwnProps = {
    item: ConfigDownloadItem;
}

const DownloadsDropdownFile = ({item}: OwnProps) => {
    return (
        <div className='DownloadsDropdown__File'>
            <div className='DownloadsDropdown__File__Body'>
                <Thumbnail item={item}/>
                <div className='DownloadsDropdown__File__Body__Details'>
                    <div className='DownloadsDropdown__File__Body__Details__Filename'>
                        {item.filename}
                    </div>
                    <div className='DownloadsDropdown__File__Body__Details__FileSizeAndStatus'>
                        <FileSizeAndStatus item={item}/>
                    </div>
                </div>
                <ThreeDotButton item={item}/>
            </div>
            {item.state === 'progressing' && <div className='DownloadsDropdown__File__ProgressBar'>
                {item.progress}
            </div>}
        </div>
    );
};

export default DownloadsDropdownFile;
