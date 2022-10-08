// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/downloads';

import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from 'react-bootstrap';

import classNames from 'classnames';

import {START_UPGRADE} from 'common/communication';

import Thumbnail from '../Thumbnail';
import FileSizeAndStatus from '../FileSizeAndStatus';

type OwnProps = {
    item: DownloadedItem;
}

const UpdateAvailable = ({item}: OwnProps) => {
    const translate = useIntl();

    const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault?.();
        window.postMessage({type: START_UPGRADE}, window.location.href);
    };

    return (
        <div className='DownloadsDropdown__File update'>
            <div className='DownloadsDropdown__File__Body'>
                <Thumbnail item={item}/>
                <div className='DownloadsDropdown__File__Body__Details'>
                    <div className='DownloadsDropdown__File__Body__Details__Filename'>
                        {translate.formatMessage({id: 'renderer.downloadsDropdown.Update.MattermostVersionX', defaultMessage: `Mattermost version ${item.filename}`}, {version: item.filename})}
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
