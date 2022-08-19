// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ConfigDownloadItem} from 'types/config';

import {DOWNLOADS_DROPDOWN_OPEN_FILE} from 'common/communication';

import FileSizeAndStatus from './FileSizeAndStatus';
import ThreeDotButton from './ThreeDotButton';
import Thumbnail from './Thumbnail';

type OwnProps = {
    item: ConfigDownloadItem;
}

const DownloadsDropdownFile = ({item}: OwnProps) => {
    const onFileClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        window.postMessage({type: DOWNLOADS_DROPDOWN_OPEN_FILE, payload: {item}}, window.location.href);
    };

    return (
        <div
            className='DownloadsDropdown__File'
            onClick={onFileClick}
        >
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
