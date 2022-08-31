// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/downloads';
import classNames from 'classnames';

import {DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER} from 'common/communication';

import FileSizeAndStatus from './FileSizeAndStatus';
import ProgressBar from './ProgressBar';
import ThreeDotButton from './ThreeDotButton';
import Thumbnail from './Thumbnail';

type OwnProps = {
    item: DownloadedItem;
}

const DownloadsDropdownFile = ({item}: OwnProps) => {
    const onFileClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        window.postMessage({type: DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER, payload: {item}}, window.location.href);
    };

    return (
        <div
            className={classNames('DownloadsDropdown__File', {
                progressing: item.state === 'progressing',
            })}
            onClick={onFileClick}
        >
            <div className='DownloadsDropdown__File__Body'>
                <Thumbnail item={item}/>
                <div className='DownloadsDropdown__File__Body__Details'>
                    <div className='DownloadsDropdown__File__Body__Details__Filename'>
                        {item.filename}
                    </div>
                    <div
                        className={classNames('DownloadsDropdown__File__Body__Details__FileSizeAndStatus', {
                            cancelled: (/(cancelled|deleted|interrupted)/).test(item.state),
                        })}
                    >
                        <FileSizeAndStatus item={item}/>
                    </div>
                </div>
                <ThreeDotButton item={item}/>
            </div>
            <ProgressBar item={item}/>
        </div>
    );
};

export default DownloadsDropdownFile;
