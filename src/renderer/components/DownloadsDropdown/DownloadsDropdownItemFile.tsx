// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import FileSizeAndStatus from './FileSizeAndStatus';
import ProgressBar from './ProgressBar';
import ThreeDotButton from './ThreeDotButton';
import Thumbnail from './Thumbnail';

type OwnProps = {
    activeItem?: DownloadedItem;
    item: DownloadedItem;
    appName: string;
}

const DownloadsDropdownItemFile = ({item, activeItem, appName}: OwnProps) => {
    const [threeDotButtonVisible, setThreeDotButtonVisible] = useState(false);
    const translate = useIntl();

    const onFileClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        window.desktop.downloadsDropdown.openFile(item);
    };

    const itemFilename = item.type === 'update' ?
        translate.formatMessage({id: 'renderer.downloadsDropdown.Update.MattermostVersionX', defaultMessage: `{appName} version ${item.filename}`}, {version: item.filename, appName}) :
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
