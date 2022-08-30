// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DownloadedItem} from 'types/config';

import {getDownloadingFileStatus, getFileSizeOrBytesProgress} from 'renderer/utils';

type OwnProps = {
    item: DownloadedItem;
}

const FileSizeAndStatus = ({item}: OwnProps) => {
    const fileSizeOrByteProgress = getFileSizeOrBytesProgress(item);
    const status = getDownloadingFileStatus(item);

    return (
        <>
            {fileSizeOrByteProgress}{' • '}{status}
        </>
    );
};

export default FileSizeAndStatus;
