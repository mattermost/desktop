// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Button} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import type {DownloadedItem} from 'types/downloads';

import FileSizeAndStatus from '../FileSizeAndStatus';
import Thumbnail from '../Thumbnail';

type OwnProps = {
    item: DownloadedItem;
    appName: string;
}

const UpdateAvailable = ({item, appName}: OwnProps) => {
    const translate = useIntl();

    const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault?.();
        window.desktop.downloadsDropdown.startUpgrade();
    };

    return (
        <div className='DownloadsDropdown__File update'>
            <div className='DownloadsDropdown__File__Body'>
                <Thumbnail item={item}/>
                <div className='DownloadsDropdown__File__Body__Details'>
                    <div className='DownloadsDropdown__File__Body__Details__Filename'>
                        {translate.formatMessage({id: 'renderer.downloadsDropdown.Update.MattermostVersionX', defaultMessage: `{appName} version ${item.filename}`}, {version: item.filename, appName})}
                    </div>
                    <div
                        className={classNames('DownloadsDropdown__File__Body__Details__FileSizeAndStatus', {
                            cancelled: (/(cancelled|deleted|interrupted)/).test(item.state),
                        })}
                    >
                        <FileSizeAndStatus item={item}/>
                    </div>
                    <Button
                        id='restartAndUpdateButton'
                        className='primary-button'
                        onClick={onButtonClick}
                    >
                        <FormattedMessage
                            id='renderer.downloadsDropdown.Update.RestartAndUpdate'
                            defaultMessage={'Restart & update'}
                        />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default UpdateAvailable;
