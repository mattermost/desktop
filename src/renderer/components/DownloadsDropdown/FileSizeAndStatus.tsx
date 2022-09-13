// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {DownloadedItem} from 'types/downloads';

import {getDownloadingFileStatus, getFileSizeOrBytesProgress, prettyETA} from 'renderer/utils';

type OwnProps = {
    item: DownloadedItem;
}

const FileSizeAndStatus = ({item}: OwnProps) => {
    const translate = useIntl();

    const {totalBytes, receivedBytes, addedAt} = item;

    const getRemainingTime = useCallback(() => {
        const elapsedMs = Date.now() - addedAt;
        const bandwidth = receivedBytes / elapsedMs;
        const etaMS = Math.round((totalBytes - receivedBytes) / bandwidth);
        return prettyETA(etaMS, translate);
    }, [receivedBytes, addedAt, totalBytes, translate]);

    const fileSizeOrByteProgress = getFileSizeOrBytesProgress(item);
    const statusOrETA = item.state === 'progressing' ? getRemainingTime() : getDownloadingFileStatus(item);

    return (
        <>
            {fileSizeOrByteProgress}{' • '}{statusOrETA}
        </>
    );
};

export default FileSizeAndStatus;
