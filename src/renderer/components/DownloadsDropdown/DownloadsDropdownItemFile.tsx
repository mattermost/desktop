// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {DownloadedItem} from 'types/downloads';
import classNames from 'classnames';

import {useIntl} from 'react-intl';

import {DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER} from 'common/communication';

import FileSizeAndStatus from './FileSizeAndStatus';
import ProgressBar from './ProgressBar';
import ThreeDotButton from './ThreeDotButton';
import Thumbnail from './Thumbnail';

type OwnProps = {
    activeItem?: DownloadedItem;
    item: DownloadedItem;
}

const DownloadsDropdownItemFile = ({item, activeItem}: OwnProps) => {
    const [threeDotButtonVisible, setThreeDotButtonVisible] = useState(false);
    const translate = useIntl();

    const onFileClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        window.postMessage({type: DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER, payload: {item}}, window.location.href);
    };

    const itemFilename = item.type === 'update' ?
        translate.formatMessage({id: 'renderer.downloadsDropdown.Update.MattermostVersionX', defaultMessage: `Mattermost version ${item.filename}`}, {version: item.filename}) :
        item.filename;

    return (
        <div
            className={classNames('DownloadsDropdown__File', {
                progressing: item.state === 'progressing',
            })}
            onClick={onFileClick}
            onMouseEnter={() => setThreeDotButtonVisible(true)}
            onMouseLeave={() => setThreeDotButtonVisible(false)}
        >
            <div className='DownloadsDropdown__File__Body'>
                <Thumbnail item={item}/>
                <div className='DownloadsDropdown__File__Body__Details'>
                    <div className='DownloadsDropdown__File__Body__Details__Filename'>
                        {itemFilename}
                    </div>
                    <div
                        className={classNames('DownloadsDropdown__File__Body__Details__FileSizeAndStatus', {
                            cancelled: (/(cancelled|deleted|interrupted)/).test(item.state),
                        })}
                    >
                        <FileSizeAndStatus item={item}/>
                    </div>
                </div>
                <ThreeDotButton
                    item={item}
                    activeItem={activeItem}
                    visible={threeDotButtonVisible}
                />
            </div>
            <ProgressBar item={item}/>
        </div>
    );
};

export default DownloadsDropdownItemFile;
